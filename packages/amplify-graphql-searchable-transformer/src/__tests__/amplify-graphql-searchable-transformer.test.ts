import { ConflictHandlerType, GraphQLTransform } from '@aws-amplify/graphql-transformer-core';
import { ModelTransformer } from '@aws-amplify/graphql-model-transformer';
import {
  anything, countResources, expect as cdkExpect, haveResource, ResourcePart,
} from '@aws-cdk/assert';
import { parse } from 'graphql';
import { SearchableModelTransformer } from '..';

const featureFlags = {
  getBoolean: jest.fn().mockImplementation((name): boolean => {
    if (name === 'improvePluralization') {
      return true;
    }
    return false;
  }),
  getNumber: jest.fn(),
  getObject: jest.fn(),
};

test('SearchableModelTransformer validation happy case', () => {
  const validSchema = `
    type Post @model @searchable {
        id: ID!
        title: String!
        createdAt: String
        updatedAt: String
    }
    `;
  const transformer = new GraphQLTransform({
    transformers: [new ModelTransformer(), new SearchableModelTransformer()],
    featureFlags,
  });
  const out = transformer.transform(validSchema);
  expect(out).toBeDefined();
  parse(out.schema);
  expect(out.schema).toMatchSnapshot();
});

test('SearchableModelTransformer vtl', () => {
  const validSchema = `
    type Post @model @searchable {
        id: ID!
        title: String!
        createdAt: String
        updatedAt: String
    }
    `;
  const transformer = new GraphQLTransform({
    transformers: [new ModelTransformer(), new SearchableModelTransformer()],
    featureFlags,
  });

  const out = transformer.transform(validSchema);
  expect(parse(out.schema)).toBeDefined();
  expect(out.resolvers).toMatchSnapshot();
});

test('SearchableModelTransformer with datastore enabled vtl', () => {
  const validSchema = `
    type Post @model @searchable {
        id: ID!
        title: String!
        createdAt: String
        updatedAt: String
    }
    `;
  const transformer = new GraphQLTransform({
    transformers: [new ModelTransformer(), new SearchableModelTransformer()],
    featureFlags,
    resolverConfig: {
      project: {
        ConflictHandler: ConflictHandlerType.AUTOMERGE,
        ConflictDetection: 'VERSION',
      },
    },
  });

  const out = transformer.transform(validSchema);
  expect(parse(out.schema)).toBeDefined();
  expect(out.resolvers['Query.searchPosts.req.vtl']).toMatchSnapshot();
  expect(out.resolvers['Query.searchPosts.res.vtl']).toMatchSnapshot();
  expect(out.resolvers['Query.searchPosts.res.vtl']).toContain('$util.qr($row.put("_version", $entry.get("_version")))');
});

test('SearchableModelTransformer with query overrides', () => {
  const validSchema = `type Post @model @searchable(queries: { search: "customSearchPost" }) {
        id: ID!
        title: String!
        createdAt: String
        updatedAt: String
    }
    `;
  const transformer = new GraphQLTransform({
    transformers: [new ModelTransformer(), new SearchableModelTransformer()],
    featureFlags,
  });
  const out = transformer.transform(validSchema);
  expect(out).toBeDefined();
  expect(parse(out.schema)).toBeDefined();
  expect(out.schema).toMatchSnapshot();
});

test('SearchableModelTransformer with only create mutations', () => {
  const validSchema = `type Post @model(mutations: { create: "customCreatePost" }) @searchable {
        id: ID!
        title: String!
        createdAt: String
        updatedAt: String
    }
    `;
  const transformer = new GraphQLTransform({
    transformers: [new ModelTransformer(), new SearchableModelTransformer()],
    featureFlags,
  });
  const out = transformer.transform(validSchema);
  expect(out).toBeDefined();
  expect(out.schema).toBeDefined();
  expect(out.schema).toMatchSnapshot();
});

test('SearchableModelTransformer with multiple model searchable directives', () => {
  const validSchema = `
    type Post @model @searchable {
        id: ID!
        title: String!
        createdAt: String
        updatedAt: String
    }

    type User @model @searchable {
        id: ID!
        name: String!
    }
    `;
  const transformer = new GraphQLTransform({
    transformers: [new ModelTransformer(), new SearchableModelTransformer()],
    featureFlags,
  });
  const out = transformer.transform(validSchema);
  expect(out).toBeDefined();
  expect(out.schema).toBeDefined();
  expect(out.schema).toMatchSnapshot();
});

test('SearchableModelTransformer with sort fields', () => {
  const validSchema = `
    type Post @model @searchable {
        id: ID!
        title: String!
        createdAt: String
        updatedAt: String
    }
    `;
  const transformer = new GraphQLTransform({
    transformers: [new ModelTransformer(), new SearchableModelTransformer()],
    featureFlags,
  });
  const out = transformer.transform(validSchema);
  expect(out).toBeDefined();
  expect(out.schema).toBeDefined();
  expect(out.schema).toMatchSnapshot();
});

test('it generates expected resources', () => {
  const validSchema = `
    type Post @model @searchable {
        id: ID!
        title: String!
        createdAt: String
        updatedAt: String
    }
    type Todo @model @searchable {
        id: ID!
        name: String!
        description: String
        createdAt: String
        updatedAt: String
    }
    type Comment @model {
      id: ID!
      content: String!
    }
 `;
  const transformer = new GraphQLTransform({
    transformers: [new ModelTransformer(), new SearchableModelTransformer()],
    featureFlags,
  });
  const out = transformer.transform(validSchema);
  expect(out).toBeDefined();
  const searchableStack = out.stacks.SearchableStack;
  cdkExpect(searchableStack).to(
    haveResource('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com',
            },
          },
        ],
        Version: '2012-10-17',
      },
    }),
  );
  cdkExpect(searchableStack).to(
    haveResource('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'appsync.amazonaws.com',
            },
          },
        ],
        Version: '2012-10-17',
      },
    }),
  );
  cdkExpect(searchableStack).to(
    haveResource('AWS::Elasticsearch::Domain', {
      DomainName: anything(),
      EBSOptions: anything(),
      ElasticsearchClusterConfig: anything(),
      ElasticsearchVersion: '7.10',
    }, ResourcePart.Properties),
  );
  cdkExpect(searchableStack).to(
    haveResource('AWS::Elasticsearch::Domain', {
      UpdateReplacePolicy: 'Delete',
      DeletionPolicy: 'Delete',
    }, ResourcePart.CompleteDefinition),
  );
  cdkExpect(searchableStack).to(
    haveResource('AWS::AppSync::DataSource', {
      ApiId: {
        Ref: anything(),
      },
      Name: 'OpenSearchDataSource',
      Type: 'AMAZON_ELASTICSEARCH',
      ElasticsearchConfig: {
        AwsRegion: {
          'Fn::Select': [
            3,
            {
              'Fn::Split': [
                ':',
                {
                  'Fn::GetAtt': ['OpenSearchDomain', 'Arn'],
                },
              ],
            },
          ],
        },
        Endpoint: {
          'Fn::Join': [
            '',
            [
              'https://',
              {
                'Fn::GetAtt': ['OpenSearchDomain', 'DomainEndpoint'],
              },
            ],
          ],
        },
      },
      ServiceRoleArn: {
        'Fn::GetAtt': ['OpenSearchAccessIAMRole6A1D9CC5', 'Arn'],
      },
    }),
  );
  cdkExpect(searchableStack).to(countResources('AWS::AppSync::Resolver', 2));
  cdkExpect(searchableStack).to(
    haveResource('AWS::AppSync::Resolver', {
      ApiId: {
        Ref: anything(),
      },
      FieldName: anything(),
      TypeName: 'Query',
      Kind: 'PIPELINE',
      PipelineConfig: {
        Functions: [
          {
            Ref: anything(),
          },
          {
            'Fn::GetAtt': [anything(), 'FunctionId'],
          },
        ],
      },
      RequestMappingTemplate: {
        'Fn::Join': [
          '',
          [
            anything(),
            {
              Ref: anything(),
            },
            '"))\n$util.qr($ctx.stash.put("endpoint", "https://',
            {
              'Fn::GetAtt': ['OpenSearchDomain', 'DomainEndpoint'],
            },
            '"))\n$util.toJson({})',
          ],
        ],
      },
      ResponseMappingTemplate: '$util.toJson($ctx.prev.result)',
    }),
  );
  cdkExpect(searchableStack).to(
    haveResource('AWS::AppSync::FunctionConfiguration', {
      ApiId: {
        Ref: anything(),
      },
      DataSourceName: {
        'Fn::GetAtt': [anything(), 'Name'],
      },
      FunctionVersion: '2018-05-29',
      Name: anything(),
      RequestMappingTemplateS3Location: {
        'Fn::Join': [
          '',
          [
            's3://',
            {
              Ref: anything(),
            },
            '/',
            {
              Ref: anything(),
            },
            anything(),
          ],
        ],
      },
      ResponseMappingTemplateS3Location: {
        'Fn::Join': [
          '',
          [
            's3://',
            {
              Ref: anything(),
            },
            '/',
            {
              Ref: anything(),
            },
            anything(),
          ],
        ],
      },
    }),
  );
});

test('SearchableModelTransformer enum type generates StringFilterInput', () => {
  const validSchema = `
    type Employee @model @searchable {
      id: ID!
      firstName: String!
      lastName: String!
      type: EmploymentType!
    }

    enum EmploymentType {
      FULLTIME
      HOURLY
    }
    `;
  const transformer = new GraphQLTransform({
    transformers: [new ModelTransformer(), new SearchableModelTransformer()],
    featureFlags,
  });
  const out = transformer.transform(validSchema);
  expect(out).toBeDefined();
  parse(out.schema);
  expect(out.schema).toMatchSnapshot();
});

describe('SearchableModelTransformer with datastore enabled and sort field defined vtl', () => {
  test('it should populate auto-generated timestamp fields in non keywords and omit datastore reserved fields when in implicit schema', () => {
    const validSchema = `
      type Post @model @searchable {
        id: ID!
        title: String!
      }
    `;
    const transformer = new GraphQLTransform({
      transformers: [new ModelTransformer(), new SearchableModelTransformer()],
      featureFlags,
      resolverConfig: {
        project: {
          ConflictHandler: ConflictHandlerType.AUTOMERGE,
          ConflictDetection: 'VERSION',
        },
      },
    });

    const out = transformer.transform(validSchema);
    expect(parse(out.schema)).toBeDefined();
    expect(out.resolvers['Query.searchPosts.req.vtl']).toMatchSnapshot();
    expect(out.resolvers['Query.searchPosts.res.vtl']).toMatchSnapshot();
  });
});
