const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { v4: uuidv4 } = require('uuid')

const prisma = new PrismaClient()

const app = express()

app.use(express.json())

app.post('/orders', async (req, res) => {
  const { sourceOrderId, accountRef, items } = req.body;

  const order = await prisma.order.create({
    data: {
      sourceOrderId,
      accountRef,
      items: {
        create: items.map((item) => ({
          itemTemplate: item.itemTemplate,
          artFrontUrl: item.artFrontUrl,
          artBackUrl: item.artBackUrl,
          shippingAddressName: item.shippingAddressName,
          shippingAddressLine1: item.shippingAddressLine1,
          shippingAddressLine2: item.shippingAddressLine2,
          shippingAddressTown: item.shippingAddressTown,
          shippingAddressState: item.shippingAddressState,
          shippingAddressCountry: item.shippingAddressCountry,
          shippingAddressZipCode: item.shippingAddressZipCode,
          sourceItemId: item.sourceItemId,
        })),
      },
    },
  });

  res.json(order);
});

app.get('/items', async (req, res) => {
    try {
      const items = await prisma.item.findMany();
      res.json(items);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error retrieving items' });
    }
});

app.listen(3000, () => {
  console.log('Server running at port 3000')
})