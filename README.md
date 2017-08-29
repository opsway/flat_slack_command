OpsWay Flat command for slack
====================


Before you begin
----------------
  1. Select or create a Cloud Platform project.
  [Go to the Projects page](https://console.cloud.google.com/project)

  2. Enable billing for your project (or use exists).
  [Enable billing](https://support.google.com/cloud/answer/6293499#enable-billing)
    
  3. Enable the Cloud Functions and Google Knowledge Graph Search APIs.
  [Enable the APIs](https://console.cloud.google.com/flows/enableapi?apiid=cloudfunctions,googleapis.com&redirect=https://cloud.google.com/functions/docs/tutorials/ocr)
    
  4. Install and initialize the Cloud SDK. [Manual](https://cloud.google.com/sdk/docs/)
  
  5.  Update and install gcloud components:
```
    gcloud components update &&
    gcloud components install beta
```
  6.  Prepare your environment for Node.js development. [Guide](https://cloud.google.com/nodejs/docs/setup)
  
  
Development
-------------

 - npm install
 - code changes
 - commit & push
 
 Deploy
 -------------
 - Create bucket (optional only first time): `gsutil mb gs://flat_slack_command`
 - Rename .dist files in .credentials folder and fill access info
 - Upload: `gcloud beta functions deploy flatCommand --stage-bucket flat_slack_command --trigger-http`
  

CI Integration
----------------

Coming soon...
- automatic deploy after push with stored credentials in CI to google