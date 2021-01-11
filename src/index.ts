import type { Probot, WebhookPayloadWithRepository } from 'probot';
import type { WebhookEvents } from '@octokit/webhooks';
import Ajv, { ErrorObject } from 'ajv';
import prettier from 'prettier';

import webhooksSchema from '@octokit/webhooks-definitions/schema.json';
import type { JSONSchema7, JSONSchema7Type } from 'json-schema';
import type { components } from '@octokit/openapi-types';

type GetRepoContentResponseDataFile = components["schemas"]["content-file"]
type JSONObject = {
  [key: string]: JSONObject | string | number | null | boolean | Array<JSONObject>
}

export default async (app: Probot) => {
  app.on('*', async context => {
    const { payload, name } = context;
    const opts = {
      repo: 'webhooks',
      owner: 'octokit'
    }
    const result = validateSchema(payload, name);

    if (!result.validated && Array.isArray(result.errors)) {
      try {
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
      } catch (e) {
        // Handle errors
      }
    }
  });
};

function validateSchema(payload: WebhookPayloadWithRepository, event: WebhookEvents): { validated: true } | { validated: false; errors: ErrorObject<string, Record<string, any>, JSONSchema7>[] } {
  const ajv = new Ajv();

  let hasErrors = false;
  try {
    const validationResult = ajv.validate(webhooksSchema, payload);
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
  if (hasErrors) {
    return { validated: false, errors: ajv.errors as ErrorObject<string, Record<string, any>, JSONSchema7>[] };
  }
  return { validated: true }
}
function editContentToFixSchema(content: string, result: { validated: false; errors: ErrorObject<string, Record<string, any>, JSONSchema7>[] }) {
  // Sample output
  /*{
    "validate": false,
    "errors": [
      {
        "keyword": "type",
        "dataPath": "/head_commit",
        "schemaPath": "#/properties/head_commit/type",
        "params": {
          "type": "null"
        },
        "message": "should be null"
      },
      {
        "keyword": "oneOf",
        "dataPath": "",
        "schemaPath": "#/oneOf",
        "params": {
          "passingSchemas": null
        },
        "message": "should match exactly one schema in oneOf"
      }
    ]
  }*/
  result.errors.forEach(err => {
    const [ , ...path ] = err.dataPath.split('/');
    const [ , ...schemaPath ] = err.schemaPath.split('/') as (keyof JSONSchema7)[];

    let property: any | undefined;
    for (let p of path) {
      let d = err.data as WebhookPayloadWithRepository
      if (property === undefined) {
        property = d[p]
      } else {
        property = property[p]
      }
    }
    
    let schemaProperty: any | undefined
    for (let p of schemaPath) {
      let d = err.schema!
      if (schemaProperty === undefined) {
        schemaProperty = d[p]
      } else {
        schemaProperty = schemaProperty[p]
      }
    }
    
    let sP: JSONSchema7 = schemaProperty!
    let jP: JSONObject = property

    switch (err.keyword) {
      case 'type': {
        if (Array.isArray(sP.oneOf)) {
          // @ts-expect-error We won't ever have any functions, BigInt or any non-primitive type
          sP.oneOf.push({ type: typeof jP })
        } else {
          // @ts-expect-error We won't ever have any functions, BigInt or any non-primitive type
          sP.oneOf = [ { type: sP.type, enum: sP.enum }, { type: typeof jP } ]
        }
        break;
      }
      case 'additionalProperties': {
        
        break;
      }
      case 'enum': {
        (sP as JSONSchema7Type[])!.push(jP === null ? 'null' : jP)
      }
    }
  })
  
  // Return the schema that has been passed through prettier
  return prettier.format(JSON.stringify(schema))
}
