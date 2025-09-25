-- SQL script to insert or update the formatted assessment questions
-- Run this in your Supabase SQL editor

-- German Assessment Question
INSERT INTO questions (text, difficulty_level, is_active)
VALUES (
  'Deutsch (German) 🇩🇪
Kurzfallstudie: Apex Media & FinSmart – Testkampagne zur Markenbekanntheit auf Spotify

Der Kunde und die Agentur
Agentur: Apex Media, eine Full-Service-Mediaagentur unter der Leitung von Geschäftsführer Elias Vance.
Kunde: FinSmart, eine neue Finanzmarke, die Beratung zu Altersvorsorge und Schuldenabbau anbietet.
Ziel: Steigerung der Markenbekanntheit und Reichweite in australischen Großstädten.

Die Herausforderung
FinSmart musste eine Testkampagne für eine Nischenzielgruppe starten, stand jedoch vor zwei großen Herausforderungen:
Nischenzielgruppe: Personen im Alter von 45 bis 60 Jahren, die kurz vor dem Ruhestand stehen und Interesse an Finanzen und Wirtschaft haben.
Fehlende Kreative: Als Startup besaß FinSmart keine Audio-Werbemittel für das geplante Testbudget von $2.000 bis $5.000.

Die Lösung (Spotify Ads Manager)
Anya Sharma (Spotify-Spezialistin) führte Apex Media durch die Self-Serve-Plattform:
Kostenlose Kreativleistungen: Das Problem der fehlenden Assets wurde durch das Angebot einer kostenlosen Audio-Ad-Produktion (24 bis 48 Stunden Bearbeitungszeit) gelöst; FinSmart musste lediglich ein Skript liefern.
Targeting: Es wurden umfassende Steuerungsmöglichkeiten für die Nischenzielgruppe demonstriert (45–60, australische Hauptstädte, Interesse an Finanzen/Wirtschaft), wobei die Möglichkeit bestätigt wurde, sowohl Musik als auch Podcasts gezielt zu belegen.
Kontoeinrichtung: Apex Media richtete erfolgreich ein Agentur-MCC-Konto (My Client Center) ein, um FinSmart und zukünftige kleine Kunden effizient zu verwalten.
Planungshilfe: Es wurde gezeigt, wie die Plattform geschätzte Ergebnisse und Benchmark-CPMs sofort nach Auswahl des Targetings liefert, was Apex Media bei ihren Budgetvorschlägen unterstützt.

Ergebnis
Apex Media erhielt die notwendigen Werkzeuge und Unterstützung (kostenlose Kreativleistungen, Nischen-Targeting, Agenturverwaltungsstruktur), um die Durchführung der kostengünstigen, aber hochwertigen Testkampagne zur Markenbekanntheit bei FinSmart voranzutreiben.

Was war die größte Herausforderung für FinSmart (den Kunden) in Bezug auf die kreativen Assets, und wie hat Anya Sharma (Spotify) dieses Problem sofort gelöst?
Was ist das primäre Marketingziel für die FinSmart-Kampagne, und was sind die beiden Kernelemente ihrer Zielgruppe (Alter und Interesse)?
Was würden Sie anders machen, um dem Kunden eine Lösung anzubieten?',
  'medium',
  true
) ON CONFLICT (text) DO UPDATE SET
  text = EXCLUDED.text,
  difficulty_level = EXCLUDED.difficulty_level,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- French Assessment Question
INSERT INTO questions (text, difficulty_level, is_active)
VALUES (
  'Französisch (French) 🇫🇷
Étude de Cas Condensée : Apex Media & FinSmart – Essai de Notoriété de Marque sur Spotify

Le Client et l''Agence
Agence : Apex Media, une agence média à service complet, dirigée par le directeur général Elias Vance.
Client : FinSmart, une nouvelle marque de finance offrant des conseils sur la retraite et la réduction de la dette.
Objectif : Générer de la notoriété de marque et de la portée dans les principales capitales australiennes.

Le Défi
FinSmart devait lancer une campagne d''essai pour un public de niche, mais était confronté à deux contraintes majeures :
Public de Niche : Individus âgés de 45 à 60 ans approchant de la retraite et ayant un intérêt pour la finance et les affaires.
Absence de Créatifs : FinSmart étant une start-up, elle ne disposait d''aucune ressource créative audio pour le budget d''essai proposé de 2 000 à 5 000 $.

La Solution (Spotify Ads Manager)
Anya Sharma (spécialiste Spotify) a guidé Apex Media sur l''utilisation de la plateforme en libre-service :
Création Gratuite : Le problème des ressources a été résolu en offrant la production gratuite d''annonces audio avec un délai de 24 à 48 heures ; FinSmart n''avait besoin de fournir qu''un script.
Ciblage : Démonstration des contrôles complets pour le public de niche (45-60 ans, capitales australiennes, intérêt pour la finance/les affaires), confirmant la capacité de cibler à la fois la musique et les podcasts.
Configuration du Compte : Apex Media a réussi à créer un compte MCC d''agence (My Client Center) pour une gestion efficace de FinSmart et des futurs petits clients.
Planification : Il a été montré comment la plateforme fournit des résultats estimés et des CPM de référence instantanément après la sélection du ciblage, aidant ainsi Apex Media dans ses propositions budgétaires.

Résultat
Apex Media a acquis les outils et le soutien nécessaires (création gratuite, ciblage de niche, structure de gestion d''agence) pour aller de l''avant avec la proposition d''essai de notoriété de marque à faible budget mais à forte valeur ajoutée à FinSmart.

Quel était le défi le plus important pour FinSmart (le client) concernant ses ressources créatives, et comment Anya Sharma (Spotify) l''a-t-elle résolu immédiatement ?
Quel est l''objectif marketing principal de la campagne FinSmart, et quels sont les deux éléments essentiels de leur public cible (Âge et Intérêt) ?
Que feriez-vous différemment pour fournir une solution au client ?',
  'medium',
  true
) ON CONFLICT (text) DO UPDATE SET
  text = EXCLUDED.text,
  difficulty_level = EXCLUDED.difficulty_level,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Check that questions were inserted/updated correctly
SELECT id, LEFT(text, 100) || '...' as text_preview, difficulty_level, is_active, created_at 
FROM questions 
WHERE text LIKE 'Deutsch (German)%' OR text LIKE 'Französisch (French)%'
ORDER BY created_at DESC;
