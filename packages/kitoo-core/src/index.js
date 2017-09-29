/**
 * Created by artak on 2/22/17.
 */

import globals from './globals'

let {EVENTS} = globals;

export {Storage, getStorageInstance, setStorageInstance} from './storage'

export {default as Router} from './routerService'
export {default as Service} from './serviceBase'
export {default as Network} from './networkService'
export {default as Errors} from './errors'

export {EVENTS}