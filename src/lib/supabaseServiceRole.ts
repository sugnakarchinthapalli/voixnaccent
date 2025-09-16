import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL environment variable is required');
}

// Retry configuration for database operations
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_BASE = 1000; // 1 second
const RETRY_DELAY_MAX = 5000; // 5 seconds

// Exponential backoff with jitter
const calculateRetryDelay = (attempt: number): number => {
  const exponentialDelay = Math.min(RETRY_DELAY_BASE * Math.pow(2, attempt), RETRY_DELAY_MAX);
  const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
  return exponentialDelay + jitter;
};

// Retry wrapper for database operations
const withRetry = async <T>(operation: () => Promise<T>, context: string): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === RETRY_ATTEMPTS - 1;
      
      // Don't retry on authentication or permission errors
      if (error instanceof Error && 
          (error.message.includes('JWT') || 
           error.message.includes('permission') ||
           error.message.includes('RLS') ||
           error.message.includes('not found'))) {
        console.warn(`${context}: Non-retryable error, failing immediately:`, error.message);
        throw error;
      }
      
      if (isLastAttempt) {
        console.error(`${context}: All retry attempts exhausted`, error);
        break;
      }
      
      const delay = calculateRetryDelay(attempt);
      console.warn(`${context}: Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

// Enhanced service role client with connection pooling and retry logic
class EnhancedSupabaseServiceRole {
  private client: SupabaseClient;
  private fallbackClient: SupabaseClient;
  private useServiceRole: boolean;
  
  constructor() {
    this.fallbackClient = supabase;
    
    if (!serviceRoleKey || serviceRoleKey === 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE' || serviceRoleKey.trim() === '') {
      console.warn('⚠️ Service role key not configured, using regular Supabase client as fallback');
      console.warn('⚠️ This may cause RLS issues for candidate operations');
      this.useServiceRole = false;
      this.client = supabase;
    } else {
      this.useServiceRole = true;
      this.client = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-client-info': 'voiceval-service-role'
          }
        }
      });
      console.log('✅ Service role client initialized successfully');
    }
  }
  
  // Enhanced from method with retry logic and fallback
  from(table: string) {
    const performOperation = async (operation: any, operationName: string) => {
      return withRetry(async () => {
        const result = await operation(this.client);
        if (result.error) {
          // If service role fails and we have a fallback, try it
          if (this.useServiceRole && 
              (result.error.message.includes('RLS') || 
               result.error.message.includes('permission') ||
               result.error.message.includes('policy'))) {
            console.warn(`Service role ${operationName} error, attempting fallback to regular client:`, result.error.message);
            const fallbackResult = await operation(this.fallbackClient);
            if (fallbackResult.error) throw fallbackResult.error;
            return fallbackResult;
          }
          throw result.error;
        }
        return result;
      }, `${operationName} on ${table}`);
    };
    
    return {
      select: (query = '*') => {
        const baseQuery = { query, table };
        
        return {
          eq: (column: string, value: any) => ({
            single: () => performOperation(
              (client: SupabaseClient) => client.from(table).select(query).eq(column, value).single(),
              `SELECT ${query} FROM ${table} WHERE ${column} = ${value} (single)`
            ),
            
            maybeSingle: () => performOperation(
              (client: SupabaseClient) => client.from(table).select(query).eq(column, value).maybeSingle(),
              `SELECT ${query} FROM ${table} WHERE ${column} = ${value} (maybeSingle)`
            ),
            
            // Return the query builder for chaining
            order: (column: string, options?: any) => ({
              limit: (count: number) => performOperation(
                (client: SupabaseClient) => client.from(table).select(query).eq(column, value).order(column, options).limit(count),
                `SELECT ${query} FROM ${table} WHERE ${column} = ${value} ORDER BY ${column} LIMIT ${count}`
              )
            }),
            
            // Direct execution
            execute(): Promise<any> {
              return performOperation(
                (client: SupabaseClient) => client.from(table).select(query).eq(column, value),
                `SELECT ${query} FROM ${table} WHERE ${column} = ${value}`
              );
            }
          }),
          
          in: (column: string, values: any[]) => ({
            order: (orderColumn: string, options?: any) => ({
              order: (secondOrderColumn: string, secondOptions?: any) => ({
                limit: (count: number) => performOperation(
                  (client: SupabaseClient) => client.from(table).select(query)
                    .in(column, values)
                    .order(orderColumn, options)
                    .order(secondOrderColumn, secondOptions)
                    .limit(count),
                  `SELECT ${query} FROM ${table} WHERE ${column} IN (...) ORDER BY ${orderColumn}, ${secondOrderColumn} LIMIT ${count}`
                )
              })
            })
          }),
          
          // Direct query without conditions
          order: (column: string, options?: any) => ({
            execute(): Promise<any> {
              return performOperation(
                (client: SupabaseClient) => client.from(table).select(query).order(column, options),
                `SELECT ${query} FROM ${table} ORDER BY ${column}`
              );
            }
          }),
          
          // Direct execution for select all
          execute(): Promise<any> {
            return performOperation(
              (client: SupabaseClient) => client.from(table).select(query),
              `SELECT ${query} FROM ${table}`
            );
          }
        };
      },
      
      insert: (values: any) => ({
        select: (query = '*') => ({
          single: () => performOperation(
            (client: SupabaseClient) => client.from(table).insert(values).select(query).single(),
            `INSERT INTO ${table} RETURNING ${query} (single)`
          )
        })
      }),
      
      update: (values: any) => ({
        eq: (column: string, value: any) => ({
          select: (query = '*') => ({
            single: () => performOperation(
              (client: SupabaseClient) => client.from(table).update(values).eq(column, value).select(query).single(),
              `UPDATE ${table} SET ... WHERE ${column} = ${value} RETURNING ${query}`
            )
          }),
          
          // Update without select
          execute(): Promise<any> {
            return performOperation(
              (client: SupabaseClient) => client.from(table).update(values).eq(column, value),
              `UPDATE ${table} SET ... WHERE ${column} = ${value}`
            );
          }
        })
      }),
      
      delete: () => ({
        eq: (column: string, value: any) => performOperation(
          (client: SupabaseClient) => client.from(table).delete().eq(column, value),
          `DELETE FROM ${table} WHERE ${column} = ${value}`
        )
      })
    };
  }
  
  // Storage operations with retry
  get storage() {
    const performStorageOperation = async (operation: any, operationName: string) => {
      return withRetry(async () => {
        const result = await operation(this.client);
        if (result.error) throw result.error;
        return result;
      }, operationName);
    };
    
    return {
      from: (bucket: string) => ({
        upload: (path: string, file: File | Blob, options?: any) => 
          performStorageOperation(
            (client: SupabaseClient) => client.storage.from(bucket).upload(path, file, options),
            `Storage upload to ${bucket}/${path}`
          ),
        
        getPublicUrl: (path: string) => {
          return this.client.storage.from(bucket).getPublicUrl(path);
        },
        
        remove: (paths: string[]) => 
          performStorageOperation(
            (client: SupabaseClient) => client.storage.from(bucket).remove(paths),
            `Storage remove from ${bucket}`
          ),
        
        list: (path?: string, options?: any) => 
          performStorageOperation(
            (client: SupabaseClient) => client.storage.from(bucket).list(path, options),
            `Storage list ${bucket}/${path || ''}`
          )
      })
    };
  }
  
  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await withRetry(async () => {
        const { error } = await this.client.from('candidates').select('count(*)', { count: 'exact', head: true });
        if (error) throw error;
        return { error };
      }, 'Health check');
      return true;
    } catch (error) {
      console.error('Service role client health check failed:', error);
      return false;
    }
  }
  
  // Get connection info
  getConnectionInfo() {
    return {
      useServiceRole: this.useServiceRole,
      url: supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey && serviceRoleKey !== 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE'
    };
  }
}

export const supabaseServiceRole = new EnhancedSupabaseServiceRole();
