const KitooCoreEvents = {
  ROUTER_FAIL: 'router.fail',
  ROUTER_STOP: 'router.stop',
  CONNECT_TO_ROUTER: 'router.connect',
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
    NEW_ROUTER: 'kitoo.core.network.new.router',
    GET_ROUTERS: 'kitoo.core.network.get.routers'
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