export default  {
  LAYERS: {
  },
  EVENTS: {
      ROUTER: {
          MESSAGE: 4000,
          STOP: 4001,
          MESSAGE_TYPES: {
              BROADCAST: 0,
              EMIT_ANY: 1,
              EMIT_TO: 2
          }
      },

      NETWORK: {
          NEW_ROUTER: 6000,
          STOP: 6001
      }
  }
};