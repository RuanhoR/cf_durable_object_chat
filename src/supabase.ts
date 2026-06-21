import { createClient } from '@supabase/supabase-js'
import config from './config'

const client = createClient(config.supabaseUrl, config.supabaseKey)

export default class {
	static client = client
	static get users() {
		return client.from('user_table')
	}
}
