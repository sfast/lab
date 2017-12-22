const Events = {
  ROUTER: {
    MESSAGE: 'kitoo.core.router.message'
  },

  NETWORK: {
    NEW_ROUTER: 'kitoo.core.network.new.router'
  }
}

const MessageTypes = {
  BROADCAST: 'broadcast',
  EMIT_ANY: 'any',
  EMIT_TO: 'to',
  PUBLISH: 'publish'
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

export { ServiceStatus, KitooCoreEvents, Events, MessageTypes }

export default {
  ServiceStatus,
  KitooCoreEvents,
  Events,
  MessageTypes
}
