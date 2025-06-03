import { Hono } from 'hono'
import { handle } from 'hono/aws-lambda'

import { scheduleStoreFilesForIndexing } from '@hash-stream/index-pipeline'
import { http } from '@hash-stream/utils/trustless-ipfs-gateway'

import { getIndexSchedulerProcuderContext } from './lib'
import { getHashStreamer } from './lib-hash-streamer'


const app = new Hono()

// Route responsible for kicking off the pipeline
// Schedule pipeline producer
app.get('/', async (c) => {
  const producerContext = getIndexSchedulerProcuderContext()
  for await (const scheduledFile of scheduleStoreFilesForIndexing(
    producerContext.fileStore,
    producerContext.indexScheduler,
    {
      // current only supports unixfs format
      format: 'unixfs'
    }
  )) {
    console.log('Scheduled file for indexing:', scheduledFile)
  }

  return c.text('Pipeline scheduled for indexing files!')
})

// IPFS route for testing retrieval of indexed files
// by their CIDs
app.get('/ipfs/:cid', async (c) => {
  const hashStreamer = getHashStreamer()
  return http.ipfsGet(c.req.raw, { hashStreamer })
})

export const handler = handle(app)
