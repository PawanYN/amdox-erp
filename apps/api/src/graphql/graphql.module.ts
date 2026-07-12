import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { GraphqlResolver } from './graphql.resolver';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/graphql/schema.gql'),
      sortSchema: true,
      path: '/graphql',
      context: ({ req }) => ({
        req,
        tenantId: req?.user?.tenantId,
      }),
    }),
  ],
  providers: [GraphqlResolver],
})
export class AppGraphqlModule {}
