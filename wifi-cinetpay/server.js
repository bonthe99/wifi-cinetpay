const fs = require('fs');
const express = require('express');
const PDFDocument = require('pdfkit');
const app = express();

const PORT = process.env.PORT || 3000;
app.use(express.json());

// Associer le montant payé au fichier CSV
function getCsvFileByAmount(amount) {
  switch (amount) {
    case 200: return 'tickets-200.csv';
    case 500: return 'tickets-500.csv';
    case 1000: return 'tickets-1000.csv';
    case 2000: return 'tickets-2000.csv';
    default: return null;
  }
}

// Webhook CinetPay
app.post('/callback', (req, res) => {
  const data = req.body.data;

  if (!data) return res.json({status: "failed", message: "Données manquantes"});

  if (data.status === "ACCEPTED") {
    const amount = parseInt(data.amount);
    const csvFile = getCsvFileByAmount(amount);

    if (!csvFile || !fs.existsSync(csvFile))
      return res.json({status: "failed", message: "Aucun CSV pour ce montant"});

    let csv = fs.readFileSync(csvFile, 'utf8');
    let lines = csv.split('\n');
    let header = lines[0];
    let tickets = lines.slice(1).map(line => line.split(','));

    let ticket = tickets.find(t => t[5] === "disponible");
    if (!ticket) return res.json({status: "failed", message: "Aucun ticket disponible"});

    ticket[5] = "vendu"; // Marquer comme vendu
    let newCsv = [header, ...tickets.map(t => t.join(','))].join('\n');
    fs.writeFileSync(csvFile, newCsv);

    res.json({
      status: "success",
      message: "Ticket attribué",
      username: ticket[0],
      password: ticket[1]
    });
  } else {
    res.json({status: "failed", message: "Paiement non accepté"});
  }
});

// Page de retour : PDF
app.get('/return', (req, res) => {
  const amount = parseInt(req.query.amount);
  if (!amount) return res.send("Montant non précisé");

  const csvFile = getCsvFileByAmount(amount);
  if (!csvFile || !fs.existsSync(csvFile)) return res.send("CSV introuvable pour ce montant");

  let csv = fs.readFileSync(csvFile, 'utf8');
  let lines = csv.split('\n');
  let tickets = lines.slice(1).map(line => line.split(','));

  let ticket = tickets.reverse().find(t => t[5] === "vendu");

  if (ticket) {
    const doc = new PDFDocument();
    res.setHeader('Content-disposition', `attachment; filename=ticket-${ticket[0]}.pdf`);
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);
    doc.fontSize(20).text('Ticket WiFi', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Login: ${ticket[0]}`);
    doc.text(`Password: ${ticket[1]}`);
    doc.text(`Forfait: ${ticket[2]} F`);
    doc.text(`Durée: ${ticket[3]}`);
    doc.text(`Data: ${ticket[4]}`);
    doc.end();
  } else {
    res.send("<p>Aucun ticket disponible pour ce tarif.</p>");
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
