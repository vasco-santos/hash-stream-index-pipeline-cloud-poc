import { Resource } from 'sst'
import { S3Client } from '@aws-sdk/client-s3'

// Streamer
import { HashStreamer } from '@hash-stream/streamer'

// Index
import { IndexReader } from '@hash-stream/index/reader'
import { S3LikeIndexStore } from '@hash-stream/index/store/s3-like'

// Pack
import { UnixFsPackReader } from '@hash-stream/utils/index/unixfs-pack-reader'
import { S3LikePackStore } from '@hash-stream/pack/store/s3-like'

const s3Client = new S3Client()

export function getHashStreamer() {
  const indexStore = new S3LikeIndexStore({
    bucketName: Resource.IndexStoreBucket.name as any,
    prefix: '', // Use empty prefix to access the root of the bucket
    client: s3Client,
  })
  const packStore = new S3LikePackStore({
    bucketName: Resource.PackStoreBucket.name as any,
    prefix: '', // Use empty prefix to access the root of the bucket
    client: s3Client,
    extension: '' // Use empty extension to access files without a specific extension as the location already includes this
  })

  const pathStore = new S3LikePackStore({
    bucketName: Resource.FileStoreBucket.name as string,
    prefix: '', // Use empty prefix to access the root of the bucket
    client: s3Client,
    extension: '' // Use empty extension to access files without a specific extension as the location already includes this
    })

  const indexReader = new IndexReader(indexStore)
  const packReader = new UnixFsPackReader(packStore, pathStore)

  return new HashStreamer(indexReader, packReader)
}
