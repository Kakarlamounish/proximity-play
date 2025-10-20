import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client';
import { WebSocketLink } from '@apollo/client/link/ws';
import { getMainDefinition } from '@apollo/client/utilities';

// HTTP Link for queries and mutations
const httpLink = new HttpLink({
  uri: import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
  headers: {
    authorization: `Bearer ${localStorage.getItem('supabase.auth.token')}`,
  },
});

// WebSocket Link for subscriptions
const wsLink = new WebSocketLink({
  uri: import.meta.env.VITE_GRAPHQL_WS_ENDPOINT || 'ws://localhost:4000/graphql',
  options: {
    reconnect: true,
    connectionParams: {
      authToken: localStorage.getItem('supabase.auth.token'),
    },
  },
});

// Split link for routing queries to appropriate link
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink,
);

// Apollo Client configuration
export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Custom merge functions for pagination
          bubbles: {
            keyArgs: false,
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
          messages: {
            keyArgs: ['bubbleId'],
            merge(existing = [], incoming, { args }) {
              if (!args?.after) return incoming;
              return [...existing, ...incoming];
            },
          },
          notifications: {
            keyArgs: false,
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
        },
      },
      Bubble: {
        fields: {
          messages: {
            keyArgs: false,
            merge(existing = [], incoming, { args }) {
              if (!args?.after) return incoming;
              return [...existing, ...incoming];
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'ignore',
    },
    query: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});

// Update auth token when it changes
export const updateAuthToken = (token: string | null) => {
  const newHttpLink = new HttpLink({
    uri: import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
    headers: {
      authorization: token ? `Bearer ${token}` : '',
    },
  });

  const newWsLink = new WebSocketLink({
    uri: import.meta.env.VITE_GRAPHQL_WS_ENDPOINT || 'ws://localhost:4000/graphql',
    options: {
      reconnect: true,
      connectionParams: {
        authToken: token,
      },
    },
  });

  const newSplitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'subscription'
      );
    },
    newWsLink,
    newHttpLink,
  );

  apolloClient.setLink(newSplitLink);
};