export default  {
  LAYERS: {
      DNS: 'kitoo::dnslayer',
      EXECUTOR: 'kitoo::executorlayer',
      ROUTER: 'kitoo::routerlayer',
      SERVICE: 'kitoo::servicelayer'
  },
  EVENTS: {
      EXECUTOR: {
          // ** action ticks for dns layer
          SERVICE_PACK_FINISH: 2000,
          SERVICE_COMPILE_FINISH: 2001,
          SERVICE_UP: 2002,
          SERVICE_DOWN: 2003,
          NOTIFY: 2004,
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
          // ** action ticks for executor
          SERVICE_PACK_START: 1000,
          SERVICE_COMPILE_START: 1001,
          SERVICE_UP: 1002,
          SERVICE_DOWN:1003,
          SERVICE_RESTART: 1004,
          SERVICE_STATUS: 1005,
          // ** proxy ticks down to service layer
          ROUTER_START: 1006,
          ROUTER_STOP: 1007,
          ROUTER_FAIL: 1008
      }
  }
};