import runRouter from './runRouter'
import stopRouter from './stopRouter'


export default class Commands {
  static init (vorpal) {
    runRouter(vorpal)
    stopRouter(vorpal)
  }
}