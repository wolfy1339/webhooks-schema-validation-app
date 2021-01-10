import type { Probot, WebhookPayloadWithRepository } from 'probot';
import type { WebhookEvents } from '@octokit/webhooks';
import Ajv from 'ajv';

import webhooksSchema from '@octokit/webhooks-definitions/schema.json';
import type { components } from '@octokit/openapi-types';

type GetRepoContentResponseDataFile = components["schemas"]["content-file"]

export default async (app: Probot) => {
  app.on('*', async context => {
    const { payload, name } = context;
    const opts = {
      repo: 'webhooks',
      owner: 'octokit'
    }
    const result = validateSchema(payload, name);

    if (!result.validated) {
      let { content } = (await context.octokit.repos.getContent({
        ...opts,
        path: ''
      })).data as GetRepoContentResponseDataFile;
      content = editContentToFixSchema(content, result)
      await context.octokit.repos.createOrUpdateFileContents({
        ...opts,
        message: '',
        content,
        path: '',
        branch: 'shemas-update'
      });
      const { data: { number } } = await context.octokit.pulls.create({
        ...opts,
        title: 'Update schemas',
        body: '',
        base: 'master',
        head: 'schemas-update',
      });
      await context.octokit.issues.addLabels({
        ...opts,
        issue_number: number,
        labels: ['maintenance']
      })
    }
  });
};

const ajv = new Ajv();
function validateSchema(payload: WebhookPayloadWithRepository, event: WebhookEvents) {
  let hasErrors = false;
  try {
    const validationResult = ajv.validate<typeof webhooksSchema>(webhooksSchema, payload);
    if (!validationResult) {
      console.error(`❌ Payload '${event}${payload.action ?? ''}' does not match schema`);
      console.error(ajv.errors);
      hasErrors = true;
    } else {
      console.log(`✅ Payload '${event}${payload.action ?? ''}' matches schema`);
    }
  } catch (err) {
    console.error('An error occured while validating the schemas', err.toString());
    hasErrors = true;
  }
  return { validated: hasErrors, errors: ajv.errors };
}

function editContentToFixSchema(content: string, _result: { validated: boolean; errors: Ajv['errors'] }) {
  return content
}
