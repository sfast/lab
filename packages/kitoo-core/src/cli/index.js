import Vorpal from 'vorpal';
import Commands from './cmd/index'


let vorpal = Vorpal();

Commands.init(vorpal)

vorpal.parse(process.argv);
