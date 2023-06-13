const { PDFDocument, rgb, cmyk, StandardFonts, PDFFont } = require('pdf-lib');
const fontKit = require ('@pdf-lib/fontkit')
require('dotenv').config()
const fs = require('fs');
const bucket = require('../config/firebucket');
const path = require('path');



  async function pdfMerge(body) {
    console.time()

    // Create new PDF document
    const mergedPdf = await PDFDocument.create();
    
    // Adding font files to the PDFs
    const openSansFile = fs.readFileSync(path.resolve(__dirname, '../resources/fonts/OpenSans-Regular.ttf'));
    const barcodeFile = fs.readFileSync(path.resolve(__dirname, '../resources/fonts/USPSIMBStandard.ttf'));
    
    // Loop through each object in the request body array
    for (const obj of body) {
      // Fetch PDF data from artwork1 URL
      const artworkData = await fetch(obj.artUrl).then(res => res.arrayBuffer()).catch(error => console.error(error))
      
      // Load artwork1 and artwork2 PDFs
      const artworkPdf = await PDFDocument.load(artworkData);
      
      // Get first page of artwork1 PDF
      const artwork1Page = artworkPdf.getPages()[0];
      const artwork2Page = artworkPdf.getPages()[1];

      artworkPdf.registerFontkit(fontKit)
      const openSansFont = await artworkPdf.embedFont(openSansFile)
      const barcodeFont = await artworkPdf.embedFont(barcodeFile)

      // Add name and reference number as text to artwork1 PDF
      artwork2Page.drawText(`${obj.sourceItemId} - ${obj.shipToName}`, {
        x: 390,
        y: 135,
        size: 14,
        font: openSansFont,
        color: cmyk(0, 0, 0, 1),
      });

      artwork2Page.drawText(obj.shipToAddressLine1, {
        x: 390,
        y: 115,
        size: 14,
        font: openSansFont,
        color: cmyk(0, 0, 0, 1),
      });

      artwork2Page.drawText(`${obj.shipToAddressTown}, ${obj.shipToAddressState}, ${obj.shipToAddressZipCode}`, {
        x: 390,
        y: 95,
        size: 14,
        font: openSansFont,
        color: cmyk(0, 0, 0, 1),
      });

      artwork2Page.drawText(`United States of America`, {
        x: 390,
        y: 75,
        size: 14,
        font: openSansFont,
        color: cmyk(0, 0, 0, 1),
      });

      artwork2Page.drawText(`${obj.imbCode}`, {
        x: 390,
        y: 25,
        size: 14,
        font: barcodeFont,
        color: cmyk(0, 0, 0, 1),
      });

      // Copy pages from artwork1 and artwork2 to merged PDF document
      const artworkPages = await mergedPdf.copyPages(artworkPdf, artworkPdf.getPageIndices());
      artworkPages.forEach(page => mergedPdf.addPage(page));

      console.log(`${obj.sourceItemId} - merged`);
    }

    // Write merged PDF document to file
    const pdfBytes = await mergedPdf.save();
    // const fileName = `order-200.pdf`
    fs.writeFileSync('merged.pdf', pdfBytes);

    // Save merged PDF to Firebase Storage bucket
    // await bucket.file(fileName).save(pdfBytes, {
    //   contentType: 'application/pdf',
    //   metadata: {
    //     cacheControl: 'public, max-age=31536000',
    //   },
    // });
    
    console.timeEnd()
    console.log("Merge Complete!!! - No Errors (at least no obvious ones)");
  }

  module.exports = {
    pdfMerge
  }