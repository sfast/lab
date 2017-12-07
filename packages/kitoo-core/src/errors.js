/**
 * Created by dave on 7/11/17.
 */

const KitooCoreErrorCodes = {
  NO_ONLINE_ROUTER: 0
}

class KitooCoreError extends Error {
  constructor ({serviceName, serviceId, code, error, message, description} = {}) {
    error = error || {}
    message = message || error.message
    description = description || message
    super(message)
    this.serviceId = serviceId
    this.serviceName = serviceName
    this.code = code
    this.error = error
    this.description = description
  }
}

export { KitooCoreError }
export { KitooCoreErrorCodes }

export default {
  KitooCoreErrorCodes,
  KitooCoreError
}
