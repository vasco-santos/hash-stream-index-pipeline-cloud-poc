# hash-stream-index-pipeline-cloud-poc

> An infra deployment PoC with an Indexing Pipeline for data at rest.

It enables data at rest to be served via a [`hash-stream` server](https://github.com/vasco-santos/hash-stream/tree/main) as content-addressable without being transformed. It deploys implementations from [`@hash-stream/index-pipeline`](https://github.com/vasco-santos/hash-stream/blob/main/packages/index-pipeline/README.md), in order to create indexes to enable a [`hash-stream` server](https://github.com/vasco-santos/hash-stream/tree/main) to serve this content in a content adressable fashion.

This PoC relies on [SST](https://sst.dev) to deploy cloud infrastructure. [SST](https://sst.dev) makes it easy to deploy infrastructure in Cloud Providers like AWS and CF as code. This makes it easy to bring a bucket with data at rest in AWS S3 or CF R2 into the content addressable world with minimal effort. Alternatively, one can deploy similar functions with other solutions like Terraform.

## Getting started

1. Setup an AWS account (example [instructions](https://sst.dev/docs/aws-accounts))
2. Install repository dependencies (`npm install`)
3. Run development server (`npx sst dev`)

## From PoC to Production insights

### Object Storage

The current PoC implementation sets up three buckets for demo purposes: 

```js
const fileStoreBucket = new sst.aws.Bucket("FileStoreBucket");
const packStoreBucket = new sst.aws.Bucket("PackStoreBucket");
const indexStoreBucket = new sst.aws.Bucket("IndexStoreBucket");
```

If you are looking into this repository is very likely you already have a `FileStoreBucket`, which you can modify here to just link to it via its `arn` value.

This PoC currently hardcodes the index format to be `unixfs` in `src/index.ts` (at the time of writing this is the only implementation available). This pipeline enables to serve content addressable data directly reading from your `FileStoreBucket` without requiring data transformation. However, when creating an `unixfs` index it is essential to keep some information (root block of the DAG). For that reason, an extra `PackStoreBucket` SHOULD be set to avoid mixing this information with the raw files. 

Finally, the `IndexStoreBucket` is where the indexes created are stored to facilitare a Hashstream Server to serve content addressable data.

### Scheduler

This PoC currently relies on an HTTP endpoint to trigger the pipeline for processing a given bucket. This is backed by an AWS Lambda function, which has a maximum runtime of 15 minutes. This MAY be enough to queue a large number of items while iterating a Cloud bucket datastore, but this limit MAY also be problematic with very large number of objects. For this, there are plenty of alternatives go to over the files in the file store and schedule them for indexing. For instance, one could use a SST Task, which uses Amazon ECS on AWS Fargate, run it as a long running process on an EC2 instance or even locally.

It is recommended that these functions run the closest possible to where the data lives, both for performance and cost optimization. So for simplicity:
- if one stores data in Cloudflare R2, it is recommended to run these tasks in Cloudflare workers.
- if one stores data in AWS S3, it is recommended to run these tasks in AWS Lambdas.
- if one stores data in some private storage system, ideally these tasks should run next to it.

It is worth pointing out that once each item is scheduled for indexing in this PoC, it is queued on a AWS SQS. This guarantees fault tolerant, efficient and scalable with the number of items in the bucket out of the box. While SST does not currently support Cloudflare Queues, there is nothing preventing to rely on AWS SQS for task orchestrating, while having queue consumers trigging the jobs to run close to the data in Cloudflare workers.

### Streamer server

For convenience in this PoC it is also deployed a Hashstream server in the `/ipfs/CID` route. This is for demo/test cases, and does not need to be deployed at all in the same infrastructure repo as this pipeline.

## How it works

Once you have a server running, you will see in the console the HTTP endpoint for development purposes:

```sh
✓  Complete
   Hono: https://some-id.lambda-url.us-west-2.on.aws/
```

If you are just trying this out, you SHOULD write out of bound some files into the provisioned S3 bucket, so that we can serve them as content addressable data.

One can perform an HTTP Request to trigger the pipeline to run and create indexes for all the files in the bucket.

```sh
$ curl https://some-id.lambda-url.us-west-2.on.aws/
```

In the meantime, in the `sst dev` functions panel it is possible to see the CIDs of each of the indexed files. 

```sh
|  Invoke      src/index.handler
|  +2.382s     Scheduled file for indexing: IMG_9528.mov
|  +2.7s       Scheduled file for indexing: Screenshot 2025-03-12 at 08.56.29.png
|  Done        took +3.276s
|  Build       src/index-scheduler-subscriber.handler
|  Invoke      src/index-scheduler-subscriber.handler
|  +5ms        Received SQS message: {"fileReference":"Screenshot 2025-03-12 at 08.56.29.png","options":{"format":"unixfs","size":3612099}}
|  Invoke      src/index-scheduler-subscriber.handler
|  +4ms        Received SQS message: {"fileReference":"IMG_9528.mov","options":{"format":"unixfs","size":16122488}}
|  +5.18s     File Screenshot 2025-03-12 at 08.56.29.png indexed successfully.
|  +5.181s    handled received SQS message with containing CID bafybeiaxpyk6fjzhfelde6ksf66neotwoeg24devtdl3ed3g7erosgg3qy
|  +9.33s     File Screenshot IMG_9528.mov indexed successfully.
|  +9.331s    handled received SQS message with containing CID bafybeiaxbrtsdhi4n2qv53wskm7s6dcr3wpxy7kqdcjp2tx2dafxeiqu2m
```

TODO: Request using curl for CAR file format

### Fetch content addressable data from server

#### with curl

```sh
$ curl https://gogv2d5sm4iaqwbedydtobsooe0abjhy.lambda-url.us-west-2.on.aws/ipfs/bafybeiaxpyk6fjzhfelde6ksf66neotwoeg24devtdl3ed3g7erosgg3qy\?format\=car --output bafybeiaxpyk6fjzhfelde6ksf66neotwoeg24devtdl3ed3g7erosgg3qy.car 
```

One can then rely on `ipfs-car` CLI to unpack the file and compare it with the original file. When using `ipfs-car unpack` the content is also verified to guarantee it matches the exact CID.

#### with `@helia/verified-fetch`

```js
import fs from "fs";
import { createVerifiedFetch } from "@helia/verified-fetch";
import { CID } from "multiformats/cid";

const serverUrl =
  "https://some-id.lambda-url.us-west-2.on.aws";
const cidString = "bafybeiaxpyk6fjzhfelde6ksf66neotwoeg24devtdl3ed3g7erosgg3qy";

async function main() {
  const cid = CID.parse(cidString);
  
  console.log("Fetching all content via verified fetch...");
  const verifiedFetch = await createVerifiedFetch({
    gateways: [serverUrl],
  });

  const response = await verifiedFetch(`ipfs://${cid}/`);
  console.log("response", response.status);
  const body = await response.arrayBuffer();
  const bodyBytes = new Uint8Array(body);

  // Write to disk
  await fs.promises.writeFile(
    `./${cid.toString()}`,
    Buffer.from(bodyBytes)
  );

  await verifiedFetch.stop();
}
```