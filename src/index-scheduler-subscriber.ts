import { SQSEvent } from 'aws-lambda'

import { processFileForIndexing } from '@hash-stream/index-pipeline'
import { CID } from 'multiformats/cid'

export const DAGPB_CODE = 0x70

import { getIndexSchedulerConsumerContext } from './lib'

export const handler = async (event: SQSEvent): Promise<void> => {
  const producerContext = getIndexSchedulerConsumerContext()
  for (const record of event.Records) {
    const body = record.body
    console.log("Received SQS message:", body)
    const parsedBody = JSON.parse(body)
    const containingMultihash = await processFileForIndexing(
      producerContext.fileStore,
      producerContext.packStore,
      producerContext.indexWriters,
      parsedBody.options?.format || 'unixfs',
      parsedBody.fileReference,
      {}
    )
    const containingCid = CID.createV1(DAGPB_CODE, containingMultihash)
    console.log('handled received SQS message with containing CID', containingCid.toString())
  }
}

export const dlq = async (event: SQSEvent): Promise<string> => {
  for (const record of event.Records) {
    const body = record.body
    console.log("DLQ message:", body)
  }
  return "ok"
}
