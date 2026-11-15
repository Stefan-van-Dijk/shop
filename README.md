# Shop

Persoonlijke boodschappenapp gekoppeld aan Sharon.

Nieuwe installatie zonder geïmporteerde Git-geschiedenis of persoonlijke catalogus. Gebruikers beheren hun eigen lijsten. De app bewaart automatisch lokaal; JSON-back-ups worden door de gebruiker gedownload. Delen via Sharon is een bewuste actie.

Website: https://stefan-van-dijk.github.io/shop/

Publiceren: zie PUBLISHING.md.

### Optioneel verbinden met Sharon
Shop werkt zelfstandig en gebruikt geen gedeelde Sharon-browseropslag meer.
Maak in Sharon → Notities en lijsten → Shop verbinden een tijdelijke code,
plak die in Shop → beheer (logo) → Verbind met Sharon, en bevestig de gelijke
controlecode terug in Sharon. Klik daarna in Shop op Verbinding controleren.
De code vervalt na vijf minuten. Elke Shop-installatie bewaart een eigen sleutel;
de server bewaart alleen hashes. De sleutel kan alleen boodschappenlijsten lezen
of wijzigen binnen bestaande lijsttoegang. Delen en intrekken blijven in Sharon.
Lokale lijsten worden niet automatisch gepubliceerd. Bestaande lokale data blijft
behouden; ook een eerder via browseropslag verbonden Shop moet eenmalig koppelen.

Vereist Sharon 0.4.80 en de bijbehorende `server/connections.php` op
`https://sharon.life/log/api/connections.php`. Upload alleen dat PHP-bestand;
behoud de bestaande private JSON-opslag en configuratie. Dit bestand wordt niet
door GitHub Pages geplaatst. Andere hostingdomeinen moeten in de bestaande
server-CORS-configuratie expliciet worden toegestaan.
