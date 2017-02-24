const R = require('ramda');
const knex = require('knex')({
    client     : 'pg',
    connection : `${process.env.DATABASE_URL}?ssl=true`,
    searchPath : 'salesforce',
    pool       : {
        min: process.env.MIN_POOLS || 0,
        max: process.env.MAX_POOLS || 1
    }
});

let base = {
};

let knexToSelect = name => async (...args) => {
    let toQuery = R.pipe(
        R.replace(/([A-Z])/g, ' $1'),
        R.toLower,
        R.split(' ')
    )(name);

    let col = R.pipe(
        R.takeLast(R.length(toQuery) - 3),
        R.append('_c'),
        R.join('_')
    )(toQuery);

    let result = await knex.select()
        .from(toQuery[1])
        .where(col, args[0]);

    return 'get' === toQuery[0] ? result[0] : result;
};

let proxyBase = new Proxy(
    base, {
        get: (func, name) => {
            return (name in base) ?
                base[name]
                : knexToSelect(name);
        }
    }
);


module.exports = proxyBase;