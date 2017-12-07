/**
 * Created by root on 7/18/17.
 */
import Storage from './storage'
import * as collections from './collections'

let storageInstance = new Storage()

export let getStorageInstance = function () {
  return storageInstance
}

export let setStorageInstance = function (_instance) {
  if (!(_instance instanceof Storage)) {
    throw 'the instance of storageInstance must be Storage'
  }
  storageInstance = _instance
}

export {Storage, collections}
