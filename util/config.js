import Debug from 'debug'
const debug = Debug('ankichampion:config')

debug('db_host', process.env.ANKI_CHAMPION_DEV_DB_HOST)

const config = {
	local: {
		server: 'http://192.168.1.224:8080',
		db: {
			client: 'mysql',
			connection: {
				host: process.env.ANKI_CHAMPION_DEV_DB_HOST,
				user: process.env.ANKI_CHAMPION_DEV_DB_USER,
				password: process.env.ANKI_CHAMPION_DEV_DB_PASSWORD,
				database: process.env.ANKI_CHAMPION_DEV_DB_DATABASE,
				dialect: 'mysql',
				charset: 'utf8mb4',
				dialectOptions: {
					dateStrings: true,
					typeCast: true,
				},
				timezone: 'Asia/Seoul',
				typeCast: function (field, next) {
					if (field.type === 'JSON') {
						try {
							return JSON.parse(field.string())
						} catch (e) {
							debug('e', e)
						}
					} else if (field.type == 'TINY' && field.length == 1) {
						return field.string() == '1' // 1 = true, 0 = false
					}
					return next()
				},
				pool: {
					max: 10,
					min: 2,
					idle: 10000,
					afterCreate: function (conn, done) {
						console.log('afterCreate===>')
						conn.setKeepAlive()
						conn.query('SET timezone="ASIA/SEOUL";', function (err) {
							if (err) {
								// first query failed, return error and don't try to make next query
								done(err, conn)
							} else {
								// do the second query...
								conn.query('SELECT set_limit(0.01);', function (err) {
									// if err is not falsy, connection is discarded from pool
									// if connection aquire was triggered by a query the error is passed to query promise
									done(err, conn)
								})
							}
						})
					}
				},
			},
		},
		jwt_secret: 'p9B2j6axgJQnG@vp5JvVwH7#?*R@_kU!',
		logging: true,
	},
	development: {
		server: 'https://dev.ankichampion.com',
		db: {
			client: 'mysql',
			connection: {
				host: process.env.ANKI_CHAMPION_DEV_DB_HOST,
				user: process.env.ANKI_CHAMPION_DEV_DB_USER,
				password: process.env.ANKI_CHAMPION_DEV_DB_PASSWORD,
				database: process.env.ANKI_CHAMPION_DEV_DB_DATABASE,
				dialect: 'mysql',
				charset: 'utf8mb4',
				dialectOptions: {
					charset: 'utf8mb4',
					dateStrings: true,
					typeCast: true,
				},
				typeCast: function (field, next) {
					if (field.type === 'JSON') {
						try {
							return JSON.parse(field.string())
						} catch (e) {
							debug('e', e)
						}
					} else if (field.type == 'TINY' && field.length == 1) {
						return field.string() == '1' // 1 = true, 0 = false
					}
					return next()
				},
				timezone: 'Asia/Seoul',
				pool: {
					max: 20,
					min: 1,
					idle: 5000,
					afterCreate: function (conn, done) {
						console.log('afterCreate===>')
						conn.setKeepAlive()
						conn.query('SET timezone="ASIA/SEOUL";', function (err) {
							if (err) {
								// first query failed, return error and don't try to make next query
								done(err, conn)
							} else {
								// do the second query...
								conn.query('SELECT set_limit(0.01);', function (err) {
									// if err is not falsy, connection is discarded from pool
									// if connection aquire was triggered by a query the error is passed to query promise
									done(err, conn)
								})
							}
						})
					}
				},
			},
		},
		jwt_secret: 'ouND#geCAaCyxg4us94%aqm24^b7%s&K',
		logging: false,
	},
	production: {
		server: 'https://ankichampion.com',
		db: {
			client: 'mysql',
			connection: {
				host: process.env.ANKI_CHAMPION_DEV_DB_HOST,
				user: process.env.ANKI_CHAMPION_DEV_DB_USER,
				password: process.env.ANKI_CHAMPION_DEV_DB_PASSWORD,
				database: process.env.ANKI_CHAMPION_DEV_DB_DATABASE,
				dialect: 'mysql',
				charset: 'utf8mb4',
				dialectOptions: {
					dateStrings: true,
					typeCast: true,
				},
				timezone: 'Asia/Seoul',
				typeCast: function (field, next) {
					if (field.type === 'JSON') {
						try {
							return JSON.parse(field.string())
						} catch (e) {
							debug('e', e)
						}
					} else if (field.type == 'TINY' && field.length == 1) {
						return field.string() == '1' // 1 = true, 0 = false
					}
					return next()
				},
				logging: false,
				pool: {
					max: 20,
					min: 1,
					idle: 5000,
					afterCreate: function (conn, done) {
						console.log('afterCreate===>')
						conn.setKeepAlive()
						conn.query('SET timezone="ASIA/SEOUL";', function (err) {
							if (err) {
								// first query failed, return error and don't try to make next query
								done(err, conn)
							} else {
								// do the second query...
								conn.query('SELECT set_limit(0.01);', function (err) {
									// if err is not falsy, connection is discarded from pool
									// if connection aquire was triggered by a query the error is passed to query promise
									done(err, conn)
								})
							}
						})
					}
				},
			},
		},
		jwt_secret: 'Qzdk7odYahcEBXHM5h39#6zkWdtqiKrc',
	},
}

let default_config
const env = process.env.NODE_ENV || 'local'
debug('process.env.NODE_ENV', env)
if (env === 'production') {
	default_config = config.production
} else if (env === 'local') {
	default_config = config.local
} else {
	default_config = config.development
}

export default default_config