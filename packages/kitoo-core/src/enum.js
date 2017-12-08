const Events = {
  ROUTER: {
    MESSAGE: 'kitoo.core.router.message',
    MESSAGE_TYPES: {
      BROADCAST: 'broadcast',
      EMIT_ANY: 'any',
      EMIT_TO: 'to'
    }
  },

  NETWORK: {
    NEW_ROUTER: 'kitoo.core.network.new.router'
  }
}

const KitooCoreEvents = {
  ROUTER_FAIL: 'router.fail',
  ROUTER_STOP: 'router.stop',
  NEW_ROUTER: 'new.router',
  SERVICE_WELCOME: 'service.welcome',
  SERVICE_FAIL: 'service.fail',
  SERVICE_STOP: 'service.stop'
}

const ServiceStatus = {
  INIT: 'constructor',
  ONLINE: 'online',
  OFFLINE: 'offline'
}

export { ServiceStatus, KitooCoreEvents, Events }

export default {
  ServiceStatus,
  KitooCoreEvents,
  Events
}
