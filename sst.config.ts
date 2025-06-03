/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "hash-stream-index-pipeline-cloud-poc",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    // Create the file store bucket, pack store bucket and index store bucket
    // Buckets can be wired with the pipeline via their ARN as well.
    const fileStoreBucket = new sst.aws.Bucket("FileStoreBucket");
    const packStoreBucket = new sst.aws.Bucket("PackStoreBucket");
    const indexStoreBucket = new sst.aws.Bucket("IndexStoreBucket");

    // create dead letter queue
    const indexSchedulerQueueDlq = new sst.aws.Queue("IndexSchedulerDlq");
    indexSchedulerQueueDlq.subscribe("src/index-scheduler-subscriber.dlq")

    const indexSchedulerQueue = new sst.aws.Queue("IndexSchedulerQueue", {
      dlq: indexSchedulerQueueDlq.arn,
    });

    // Create the index scheduler subscriber function
    const schedulerSubscriberFunction = new sst.aws.Function("IndexSchedulerSubscriberFunction", {
      url: true,
      handler: "src/index-scheduler-subscriber.handler",
      link: [
        fileStoreBucket,
        packStoreBucket,
        indexStoreBucket,
        indexSchedulerQueue
      ]
    })

    indexSchedulerQueue.subscribe(schedulerSubscriberFunction.arn, {
      batch: {
        size: 1, // Do sequential processing of messages
      },
    })

    // This is the entry point for the pipeline and where a HTTP Request triggers
    // the execution of the pipeline. This is made for example purposes only and
    // should not be used in production. In production, you would use a long running
    // process to go over the files in the file store and schedule them for indexing,
    // rather than a lambda function that is triggered by an HTTP request, which is
    // limited by a 15 minutes runtime.
    // Either you could use a SST Task, which uses Amazon ECS on AWS Fargate, or run
    // this as a long running process on an EC2 instance or locally.
    // https://sst.dev/docs/component/aws/task/
    new sst.aws.Function("Hono", {
      url: true,
      handler: "src/index.handler",
      timeout: "15 minutes",
      link: [
        fileStoreBucket,
        packStoreBucket,
        indexStoreBucket,
        indexSchedulerQueue
      ]
    });
  },
});
