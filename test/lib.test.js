import test from 'ava';
const data = require('../lib');

test('Una prueba', async t => {
    let account = await data.getAccountByStringCambioPassword('jkle2ro235zh0k9');
    console.log(account);
    t.is(account.id_cuenta__c, 613);

});