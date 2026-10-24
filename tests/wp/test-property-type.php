<?php
/**
 * Property content type checks. Run inside the wpcli container by tests/checks/t4-plugin.sh.
 * Prints an OK line per passed check. On the first failed check it prints FAIL and exits 1.
 * The temporary property post is deleted on every path, including failure.
 */

function lh_test_check( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
	echo "OK: $message\n";
}

function lh_test_registration() {
	lh_test_check( post_type_exists( 'property' ), 'property post type is registered' );

	$labels = get_post_type_object( 'property' )->labels;
	lh_test_check( 'Property' === $labels->singular_name && 'Properties' === $labels->name, 'property labels are Property / Properties' );
	lh_test_check( 'Add Property' === $labels->add_new_item, "property 'Add New' screen says Add Property, not Add Post" );

	$meta = get_registered_meta_keys( 'post', 'property' );
	$keys = array( 'lh_price_from', 'lh_beds', 'lh_amenities', 'lh_house_rules', 'lh_map_url', 'lh_airport_distance' );
	foreach ( $keys as $key ) {
		lh_test_check( registered_meta_key_exists( 'post', $key, 'property' ), "$key is registered for property" );
		lh_test_check( ! empty( $meta[ $key ]['show_in_rest'] ), "$key is exposed to REST" );
	}
}

function lh_test_round_trip() {
	$post_id = wp_insert_post(
		array(
			'post_type'   => 'property',
			'post_status' => 'publish',
			'post_title'  => 'Luton Homes test property',
			'post_name'   => 'lhtest-property',
		),
		true
	);
	if ( is_wp_error( $post_id ) ) {
		throw new RuntimeException( 'could not create a property post: ' . $post_id->get_error_message() );
	}

	try {
		update_post_meta( $post_id, 'lh_price_from', 123.5 );
		lh_test_check( 123.5 === (float) get_post_meta( $post_id, 'lh_price_from', true ), 'lh_price_from 123.5 is stored and read back' );

		$response = rest_do_request( new WP_REST_Request( 'GET', '/wp/v2/property/' . $post_id ) );
		$data     = $response->get_data();
		lh_test_check( isset( $data['meta']['lh_price_from'] ) && 123.5 === $data['meta']['lh_price_from'], 'lh_price_from reads back as float 123.5 over REST' );

		update_post_meta( $post_id, 'lh_price_from', 'abc' );
		lh_test_check( '' === get_post_meta( $post_id, 'lh_price_from', true ), "lh_price_from 'abc' is stored as empty, not as 0" );

		update_post_meta( $post_id, 'lh_map_url', 'https://maps.example.com/?q=Luton' );
		lh_test_check( 'https://maps.example.com/?q=Luton' === get_post_meta( $post_id, 'lh_map_url', true ), 'lh_map_url keeps a valid https URL' );

		update_post_meta( $post_id, 'lh_map_url', 'javascript:alert(1)' );
		lh_test_check( '' === get_post_meta( $post_id, 'lh_map_url', true ), 'lh_map_url drops a javascript: URL' );
	} finally {
		wp_delete_post( $post_id, true );
	}
}

try {
	lh_test_registration();
	lh_test_round_trip();
} catch ( RuntimeException $e ) {
	fwrite( STDERR, 'FAIL: ' . $e->getMessage() . PHP_EOL );
	exit( 1 );
}

echo "OK: all property type checks passed\n";
