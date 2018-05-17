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

const LoadBalancingStrategies = {
  ROUND_ROBIN: 'round.robin',
  VERSION_CUSTOMIZED: 'version.customized',
  LATENCY_OPTIMIZED: 'latency.optimized',
  CPU_OPTIMIZED: 'cpu.optimized'
}

export {
  ServiceStatus,
  MessageTypes,
  LoadBalancingStrategies
}

export default {
  ServiceStatus,
  MessageTypes,
  LoadBalancingStrategies
}
