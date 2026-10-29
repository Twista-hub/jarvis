# Datenbank-Tests

`rechte_test.sql` prüft die Rechte (Firmen, Bereiche, Rollen, Einladungen) gegen ein leeres Postgres 16.
Es legt dafür einen kleinen Ersatz für das Supabase-Schema `auth` an. Läuft automatisch im Workflow „Prüfen“.

    psql -d <leere-datenbank> -f supabase/tests/rechte_test.sql
