import { Resource } from 'sst'
import { S3Client } from '@aws-sdk/client-s3'
import { SQSClient } from '@aws-sdk/client-sqs'

// FileStore
import { S3LikeFileStore } from '@hash-stream/index-pipeline/file-store/s3-like'

// Index
import { S3LikeIndexStore } from '@hash-stream/index/store/s3-like'
import { MultipleLevelIndexWriter } from '@hash-stream/index'

// Index Pipeline
import { SQSLikeIndexScheduler } from '@hash-stream/index-pipeline/index-scheduler/sqs'

const s3Client = new S3Client()
const sqsClient = new SQSClient()

/**
 * Provides the context for the Index Scheduler Producer.
 * This includes the file store, and index scheduler.
 */
export function getIndexSchedulerProcuderContext() {
  const fileStore = new S3LikeFileStore({
    bucketName: Resource.FileStoreBucket.name as string,
    prefix: '', // Use empty prefix to access the root of the bucket
    client: s3Client
  })

  const indexScheduler = new SQSLikeIndexScheduler({
    client: sqsClient,
    queueUrl: Resource.IndexSchedulerQueue.url as string,
  })

  return {
    fileStore,
    indexScheduler
  }
}

export function getIndexSchedulerConsumerContext() {
  const client = new S3Client()
  const fileStore = new S3LikeFileStore({
    bucketName: Resource.FileStoreBucket.name as string,
    prefix: '', // Use empty prefix to access the root of the bucket
    client
  })

  const indexStore = new S3LikeIndexStore({
    bucketName: Resource.IndexStoreBucket.name as string,
    prefix: '', // Use empty prefix to access the root of the bucket
    client
  })

  const indexWriter = new MultipleLevelIndexWriter(indexStore)

  return {
    fileStore,
    indexWriters: [indexWriter],
  }
}