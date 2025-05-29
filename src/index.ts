import { Hono } from 'hono'
import { handle } from 'hono/aws-lambda'

import { scheduleStoreFilesForIndexing } from '@hash-stream/index-pipeline'

import { getIndexSchedulerProcuderContext } from './lib'

const app = new Hono()

// Route responsible for kicking off the pipeline
// Schedule pipeline producer
app.get('/', async (c) => {
  console.log('Scheduling pipeline for indexing files...')
  const producerContext = getIndexSchedulerProcuderContext()

  console.log('Scheduling pipeline for indexing files...2')
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

  console.log('Scheduling pipeline for indexing files...3')

  return c.text('Pipeline scheduled for indexing files!')
})

export const handler = handle(app)
