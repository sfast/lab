const KitooCoreEvents = {
  ROUTER_FAIL: 'router.fail',
  ROUTER_STOP: 'router.stop',
  ROUTER_RECONNECT: 'router.reconnect',
  ROUTER_RECONNECT_FAILURE: 'router.reconnect.failure',
  NEW_ROUTER: 'new.router',
  SERVICE_WELCOME: 'service.welcome',
  SERVICE_FAIL: 'service.fail',
  SERVICE_STOP: 'service.stop'
}

const Events = {
  ROUTER: {
    MESSAGE: 'kitoo.core.router.message'
  },

  NETWORK: {
    NEW_ROUTER: 'kitoo.core.network.new.router'
  }
}

export {
  Events,
  KitooCoreEvents
}

export default {
  Events,
  KitooCoreEvents
}