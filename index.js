const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { v4: uuidv4 } = require('uuid')

const prisma = new PrismaClient()

const app = express()

app.use(express.json())

app.post('/orders', async (req, res) => {
  const { sourceOrderId, items } = req.body

  // Generate a UUID for the order
  const orderId = uuidv4()

  // Create the order
  const order = await prisma.order.create({
    data: {
      id: orderId,
      sourceOrderId,
    },
  })

  // Create the items
  const itemPromises = items.map(async (item) => {
    // Generate a UUID for the item
    const itemId = uuidv4()

    // Create the item and associate it with the order
    return prisma.item.create({
      data: {
        id: itemId,
        url: item.url,
        sourceItemId: item.sourceItemId,
        order: {
          connect: {
            id: orderId,
          },
        },
      },
    })
  })

  // Wait for all the items to be created
  await Promise.all(itemPromises)

  res.json({ order })
})

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