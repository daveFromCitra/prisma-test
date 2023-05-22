const express = require('express')
const { PrismaClient } = require('@prisma/client')
const {convertJsonToExcelSort} = require('./utils/jsonToExcelSort');
const {sendWebhook} = require('./utils/webhook')
// const { v4: uuidv4 } = require('uuid')
const {pdfMerge} = require('./utils/pdfMerge')
const {logger} = require('./utils/logger')
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient({
  errorFormat: "pretty",
})

const app = express()
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url" :status :res[content-length] - :response-time ms - :req[body]', { stream: accessLogStream }));

function isAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth === process.env.API_KEY) {
    next();
  } else {
    res.status(401);
    res.send('Access forbidden');
  }
}

function isAdmin(req, res, next) {
  const auth = req.headers.admin;
  if (auth === process.env.ADMIN_KEY) {
    next();
  } else {
    res.status(401);
    res.send('Access forbidden');
  }
}

// Add CORS headers to allow requests from a specific domain
// TODO: Remove these before making live
app.use(function(req, res, next) {
  // res.header("Access-Control-Allow-Origin", "http://127.0.0.1:5500");
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(express.json({limit: '50mb'}))

app.get('/excel-dropzone', (req, res) => {
  const page = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Document</title>
      <script defer>
          // Assuming you have an HTML input field with the id "csvFileInput"
  const csvFileInput = document.getElementById('csvFileInput');
  // const submitBtn = document.getElementById('submitBtn');
  
  // Event listener for when the submit button is clicked
  // submitBtn.addEventListener('click', handleFileUpload);
  
  function handleFileUpload() {
    const file = document.getElementById('csvFileInput').files[0];
    const reader = new FileReader();
  
    reader.onload = function (e) {
      const csvData = e.target.result;
      const jsonBody = convertCsvToJson(csvData);
      sendPutRequest(jsonBody);
    };
  
    reader.readAsText(file);
  }
  
  function convertCsvToJson(csvData) {
    const lines = csvData.split('\\n');
    const headers = parseCsvLine(lines[0]);
  
    const jsonData = [];
  
    for (let i = 1; i < lines.length; i++) {
      const currentLine = parseCsvLine(lines[i]);
      if (currentLine.length !== headers.length) {
        // Skip the line if the number of columns doesn't match the header
        continue;
      }
  
      const jsonLine = {};
  
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j].trim();
        const value = currentLine[j];
        jsonLine[header] = value;
      }
  
      const modifiedJsonLine = {
        id: jsonLine['Id'],
        sequence: parseInt(jsonLine['Sequence Number'], 10),
        imbCode: jsonLine['Intelligent Mail barcode']
      };
  
      jsonData.push(modifiedJsonLine);
    }
  
    return JSON.stringify(jsonData);
  }
  
  function parseCsvLine(line) {
    const values = [];
    let currentVal = '';
    let withinQuotes = false;
  
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
  
      if (char === '"') {
        withinQuotes = !withinQuotes;
      } else if (char === ',' && !withinQuotes) {
        values.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  
    values.push(currentVal.trim());
  
    return values;
  }
  
  function sendPutRequest(jsonBody) {
      console.log(jsonBody);
    // Perform your HTTP PUT request here using the jsonBody
    // Replace the placeholder URL with your actual API endpoint
    const url = 'http://127.0.0.1:3000/items/update';
  
    fetch(url, {
      method: 'PUT',
      body: jsonBody,
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('HTTP error ' + response.status);
        }
        // Handle successful response
        console.log('PUT request successful');
      })
      .catch(error => {
        // Handle error
        console.error('Error:', error);
      });
  }
  
      </script>
  </head>
  <body>
      <input type="file" id="csvFileInput">
      <button id="submitBtn" onclick="handleFileUpload()">Submit</button>
  </body>
  </html>
  `
  res.send(page);
})

app.post('/order', isAuth, async (req, res) => {
  const { sourceOrderId, accountRef, items } = req.body;
try {
  const order = await prisma.order.create({
    data: {
      sourceOrderId,
      accountRef,
      items: {
        create: items.map((item) => ({
          itemTemplate: item.itemTemplate,
          artUrl: item.artUrl,
          shipToName: item.shipToName,
          shipToAddressLine1: item.shipToAddressLine1,
          shipToAddressLine2: item.shipToAddressLine2,
          shipToAddressTown: item.shipToAddressTown,
          shipToAddressState: item.shipToAddressState,
          shipToAddressCountry: item.shipToAddressCountry,
          shipToAddressZipCode: item.shipToAddressZipCode,
          sourceItemId: item.sourceItemId,
        })),
      },
    },
  });
  logger(order, "/order/")
  const displayOrder = {
    data: {
      sourceOrderId: order.sourceOrderId,
      status: "processing"
    }
  }
  res.json(displayOrder);
} catch (error) {
  res.status(500).json(error)
  console.error(error);
}

});

app.get('/orders', isAuth, async (req, res) => {
  try {
    const orders = await prisma.order.findMany();
    res.status(200).json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving orders' });
  }
})

// CLIENT Route
app.get('/order/:sourceOrderId', isAuth, async (req, res) => {
  const { sourceOrderId } = req.params
  try {
    const orderWithItems = await prisma.order.findUnique({
      where: {
        sourceOrderId: sourceOrderId,
      },
      select: {
        sourceOrderId: true,
        items: {
          select: {
            sourceItemId: true,
            itemStatus: true
          }
        }
      },
    });
    res.status(200).json(orderWithItems);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: `Error retrieving order ${sourceOrderId}`});
  }
})

// CLIENT Route
app.get('/items', isAuth, async (req, res) => {
    try {
      const items = await prisma.item.findMany();
      res.json(items);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error retrieving items' });
    }
});

// CLIENT Route
app.get('/item/:sourceItemId', isAuth, async (req, res) => {
  const { sourceItemId } = req.params
  
  try {
    const sourceItem = await prisma.item.findFirst({
      where: {
        sourceItemId: sourceItemId,
      },
      select: {
        itemTemplate: true,
        artUrl: true,
        shipToName: true,
        shipToAddressLine1: true,
        shipToAddressLine2: true,
        shipToAddressTown: true,
        shipToAddressState: true,
        shipToAddressCountry: true,
        shipToAddressZipCode: true,
        itemStatus: true,
        sourceItemId: true,
        order: {
          select: {
            sourceOrderId: true,
          },
        },
      },
    });

    const resultItem = {
      itemTemplate: sourceItem.itemTemplate,
      artUrl: sourceItem.artUrl,
      sourceItemId: sourceItem.itemTemplate,
      sourceOrderId: sourceItem.order.sourceOrderId,
      shipToName: sourceItem.shipToName,
      shipToAddressLine1: sourceItem.shipToAddressLine1,
      shipToAddressLine2: sourceItem.shipToAddressLine2,
      shipToAddressTown: sourceItem.shipToAddressTown,
      shipToAddressState: sourceItem.shipToAddressState,
      shipToAddressCountry: sourceItem.shipToAddressCountry,
      shipToAddressZipCode: sourceItem.shipToAddressZipCode,
      status: sourceItem.itemStatus,
    }

    res.json(resultItem)
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error retrieving item' });
  }
})

// Update any and all items
app.put('/items/update', async (req, res) => {
  try {
    const objects = req.body;
    for (const object of objects)  {
      const {id, ...updatedFields} = object;
      await prisma.item.update({
        where: { id },
        data: updatedFields
      })
    }
    res.status(200).json("Success");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
})

app.get('/order-items/:sourceOrderId', async (req, res) => {
  const { sourceOrderId } = req.params
  try {
    const items = await prisma.order.findFirst({
      where: {
        sourceOrderId: sourceOrderId // Replace with the specific sourceOrderId you want to query
      }
    }).items();
    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving items' });
  }
});

// Get a list of all unbatched items
app.get('/unbatched-items', async (req, res) => {
  try {
    const unbatchedItems = await prisma.item.findMany({
      where: {batchId: "-1"}
    })
    res.json(unbatchedItems);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving unbatched items' });
  }
});

// Get all items in a batch
app.get('/batch/:batchId', async (req, res) => {
  const { batchId } = req.params
  try {
    const batchItems = await prisma.item.findMany({
      where: {batchId: batchId}
    })
    res.json(batchItems)
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: `Error retrieving batch ${batchId}`});
  }
})

// Assign all un-assigned items to a new batch
app.put('/batch/assign/:itemTemplate/:batchId', async (req, res) => {
  // TODO: Add webhook to PR
  const { itemTemplate, batchId } = req.params
  try {
    await prisma.item.updateMany({
      where: {
        AND: [
          {batchId: "-1"},
          {itemTemplate: itemTemplate}
        ]
      },
      data: {
        batchId: batchId,
        itemStatus: "batched"
      }
    })
    res.json({ message: `Batch ${batchId} created`});
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: `Error updating batch ${batchId}`});
  }
})

// Update item status to all items in a batch
app.put('/batch/update/:itemStatus/:batchId', async (req, res) => {
  // TODO: Add webhook to PR
  const {itemStatus, batchId} = req.params
  try {
    await prisma.item.updateMany({
      where: {
        batchId: batchId
      },
      data: {
        itemStatus: itemStatus
      }
    })
    res.json({ message: `Batch ${batchId} updated to ${itemStatus}`});
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: `Error updating batch ${batchId}`});
  }

})

// Make the excel file to be loaded
app.get('/batch/export/:batchId', async (req, res) => {
  const { batchId } = req.params
  try {
    const batchItems = await prisma.item.findMany({
      where: {batchId: batchId}
    })
    convertJsonToExcelSort(batchItems, batchId);
    await prisma.item.updateMany({
      where: {
        batchId: batchId
      },
      data: {
        itemStatus: "sorting"
      }
    })
    res.json(batchItems)
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: `Error retrieving batch ${batchId}`});
  }
})

app.get('/batch/download/:batchId', async (req, res) => {
  const { batchId } = req.params
  try {
    const batchItems = await prisma.item.findMany({
      where: {batchId: batchId}
    })
    await prisma.item.updateMany({
      where: {
        batchId: batchId
      },
      data: {
        itemStatus: "sorting"
      }
    })
    res.json(batchItems)
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: `Error retrieving batch ${batchId}`});
  }
})

app.post('/batch/upload', async (req, res) => {
  try {
    console.log(req.body)
    res.status(200).json(req.body)    
  } catch (error) {
    console.error('Error updating sheet:', error);
    res.status(500).json({ error: 'Failed to upload sheet' });
  }

})

app.post('batch/pdf/:batchId', async (req, res) => {
  try {
    res.status(200).send("PDF Merge has begun.")
    const {body} = req;
    pdfMerge(body)
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});

// TODO: Tracking Update from SnailWorks - Whatever they send should be just fine.
app.post('/tracking/update', async (req, res) => {
  // try {
  //   const itemsToUpdate = req.body; // Array of objects in the request body
  //   const updatedItems = [];

  //   for (const item of itemsToUpdate) {
  //     const { id, itemStatus } = item;

  //     // Update the item in the Prisma database
  //     const updatedItem = await prisma.item.update({
  //       where: { id },
  //       data: { itemStatus },
  //     });

  //     updatedItems.push(updatedItem);
  //     console.log(`ID: ${id}, New Status: ${itemStatus}`);
  //   }
  //   logger(updatedItems)
  //   sendWebhook(updatedItems)
  //   res.status(200).send('received');
  // } catch (error) {
  //   console.error('Error updating items:', error);
  //   res.status(500);
  // }
  try {
    const itemsToUpdate = req.body;
    logger(itemsToUpdate)
    res.status(200).send('received');
  } catch (error) {
    console.error('Error updating items:', error);
    res.status(500).send('Call failed');
  }
  

})

app.post('/merge-pdfs', async (req, res) => {
  try {
    res.status(200).send("PDF Merge has begun.")
    const {body} = req;
    pdfMerge(body)
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});

app.get('/unique-batch-ids', async (req, res) => {
  try {
    const uniqueBatchIds = await prisma.item.findMany({
      select: {
        batchId: true,
      },
      distinct: ['batchId'],
    });

    res.json(uniqueBatchIds);
  } catch (error) {
    console.error('Error retrieving unique batch IDs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/manual/update', async (req, res) => {
  try {
    sendWebhook(req.body)
    res.status(200).json({message: "Sent"})
  } catch (error) {
    res.status(500).send('Internal server error')
  }
})


app.listen(3000, () => {
  console.log(`  -------------------------------------------------------
   _______  _______  _______  _______  _______  _______  ______    ______  
  |       ||       ||       ||       ||       ||   _   ||    _ |  |      | 
  |    _  ||   _   ||  _____||_     _||       ||  |_|  ||   | ||  |  _    |
  |   |_| ||  | |  || |_____   |   |  |       ||       ||   |_||_ | | |   |
  |    ___||  |_|  ||_____  |  |   |  |      _||       ||    __  || |_|   |
  |   |    |       | _____| |  |   |  |     |_ |   _   ||   |  | ||       |
  |___|    |_______||_______|  |___|  |_______||__| |__||___|  |_||______| 
   ______    __   __  _______  ___   _  __   __  _______                   
  |    _ |  |  | |  ||       ||   | | ||  | |  ||       |                  
  |   | ||  |  | |  ||       ||   |_| ||  | |  ||  _____|                  
  |   |_||_ |  |_|  ||       ||      _||  |_|  || |_____                   
  |    __  ||       ||      _||     |_ |       ||_____  |                  
  |   |  | ||       ||     |_ |    _  ||       | _____| |                  
  |___|  |_||_______||_______||___| |_||_______||_______|                     

  A Dave Blois Joint - 2023 (name subject to change)
  -------------------------------------------------------

  For more information see our documentation on GitHub.

  ...

  `)
  console.log('Ruckus has begun on port 3000')
})