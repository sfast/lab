export default  {
  LAYERS: {
      DNS: 'kitoo::dnslayer',
      EXECUTOR: 'kitoo::executorlayer',
      ROUTER: 'kitoo::routerlayer',
      SERVICE: 'kitoo::servicelayer',
      AGENT: 'kitoo::agentlayer'
  },
  EVENTS: {
      AGENT: {
          NOTIFY: 4999,
          SERVICE_UP : 5000,
          SERVICE_DOWN: 5001,
          SERVICE_RESTART: 5002,
          SERVICE_STATUS: 5003,
          SERVICE_PACK_START: 5004,
          SERVICE_PACK_FINISH: 5005,
          SERVICE_INSTALL_START: 5006,
          SERVICE_INSTALL_FINISH: 5007
      },

      EXECUTOR: {
          // ** proxy ticks up to dns layer
          START: 2005,
          STOP: 2006,
          FAIL: 2007
      },

      SERVICE: {
          // ** proxy ticks up to dns layer
          START: 3001,
          STOP: 3002,
          FAIL: 3003
      },

      DNS: {
          // ** proxy ticks down to service layer
          ROUTER_START: 1006,
          ROUTER_STOP: 1007,
          ROUTER_FAIL: 1008
      }
  }
};