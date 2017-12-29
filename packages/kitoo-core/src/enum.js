const MessageTypes = {
  BROADCAST: 'broadcast',
  EMIT_ANY: 'any',
  EMIT_TO: 'to',
  PUBLISH: 'publish'
}

const ServiceStatus = {
  INIT: 'constructor',
  ONLINE: 'online',
  OFFLINE: 'offline'
}

export { ServiceStatus, MessageTypes }

export default {
  ServiceStatus,
  MessageTypes
}
