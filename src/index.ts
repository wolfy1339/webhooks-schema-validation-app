import { Probot } from "probot";
import * as webhooks from "@octokit/webhooks-definitions/schema.json"
export = (app: Probot) => {
  app.on('*', (event) => {
    const { payload } = event;
    validateSchema(payload, webhooks)
  })
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
