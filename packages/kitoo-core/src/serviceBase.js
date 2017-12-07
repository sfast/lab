/**
 * Created by artak on 2/22/17.
 */

import shortid from 'shortid'
import Node from 'zeronode'
import { ServiceStatus } from './enum'

let _private = new WeakMap()

export default class ServiceBase extends Node {
  constructor ({ id, name, bind, options } = {}) {
    id = id || `service::${shortid.generate()}`
    // ** When creating service we are passing executorId and host via shell

    options = options || {}
    options.serviceName = name

    super({ id, bind, options })

    let _scope = {
      name,
      created: Date.now(),
      started: null,
      stoped: null,
      status: ServiceStatus.INIT
    }

    _private.set(this, _scope)
  }

  start () {
    let _scope = _private.get(this)

    _scope.started = Date.now()
    _scope.status = ServiceStatus.ONLINE
    this.logger.info(`Service ${_scope.id} started`)
    return 1
  }

  async stop () {
    await super.stop()
    let _scope = _private.get(this)

    _scope.status = ServiceStatus.OFFLINE
    _scope.stoped = Date.now()
    return 1
  }

  toJSON () {
    let _scope = _private.get(this)
    let options = this.getOptions()

    return {
      id: this.getId(),
      name: _scope.name,
      created: _scope.created,
      started: _scope.started,
      stoped: _scope.stoped,
      status: _scope.status,
      options
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
}
