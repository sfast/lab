/**
 * Created by artak on 2/22/17.
 */

import uuid from 'uuid/v4'
import { EventEmitter } from 'events'

import { ServiceStatus } from './enum'

let _private = new WeakMap()

export default class ServiceBase extends EventEmitter{
  constructor ({ id, name, options} = {}) {
    id = id || `service::${uuid()}`
    // ** When creating service we are passing executorId and host via shell

    super()

    options.serviceName = name || 'default'

    let _scope = {
      name,
      id,
      created: Date.now(),
      started: null,
      stopped: null,
      status: ServiceStatus.INIT
    }

    _private.set(this, _scope)
  }

  start () {
    let _scope = _private.get(this)

    _scope.started = Date.now()
    _scope.status = ServiceStatus.ONLINE
  }

  stop () {
    let _scope = _private.get(this)

    _scope.status = ServiceStatus.OFFLINE
    _scope.stopped = Date.now()
  }

  toJSON () {
    let _scope = _private.get(this)

    return {
      id: this.getId(),
      name: _scope.name,
      created: _scope.created,
      started: _scope.started,
      stopped: _scope.stopped,
      status: _scope.status
    }
  }

  getStatus () {
    let _scope = _private.get(this)
    return _scope.status
  }

  getName () {
    let { name } = _private.get(this)
    return name
  }

  getId () {
    let { id } = _private.get(this)
    return id
  }
}
