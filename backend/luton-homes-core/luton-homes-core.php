<?php
/**
 * Plugin Name: Luton Homes Core
 * Description: Property content type and its display fields for the Luton Homes site.
 * Version: 0.1.0
 * Requires at least: 6.0
 * Requires PHP: 8.0
 * Text Domain: luton-homes
 */

defined( 'ABSPATH' ) || exit;

function lh_register_property_type() {
	register_post_type(
		'property',
		array(
			'labels'       => array(
				'name'          => __( 'Properties', 'luton-homes' ),
				'singular_name' => __( 'Property', 'luton-homes' ),
				'add_new_item'  => __( 'Add Property', 'luton-homes' ),
				'edit_item'     => __( 'Edit Property', 'luton-homes' ),
			),
			'public'       => true,
			'has_archive'  => true,
			'rewrite'      => array( 'slug' => 'properties' ),
			'supports'     => array( 'title', 'editor', 'thumbnail', 'custom-fields' ),
			'show_in_rest' => true,
			'menu_icon'    => 'dashicons-building',
		)
	);
}
add_action( 'init', 'lh_register_property_type' );

// Booking rules (minimum stay, guests, check-in and check-out, blocked dates) are not stored here.
// lh_price_from is display-only marketing text, not the booking price.
function lh_register_property_meta() {
	$auth = static fn() => current_user_can( 'edit_posts' );

	$string_meta = array(
		'lh_beds'             => 'sanitize_text_field',
		'lh_amenities'        => 'sanitize_textarea_field',
		'lh_house_rules'      => 'sanitize_textarea_field',
		'lh_map_url'          => 'esc_url_raw',
		'lh_airport_distance' => 'sanitize_text_field',
	);
	$descriptions = array(
		'lh_amenities'   => 'Display text only. Do not enter booking rules or availability here.',
		'lh_house_rules' => 'Display text only. Do not enter booking rules here (minimum stay, maximum guests, check-in or check-out times): those live in the channel manager.',
	);
	foreach ( $string_meta as $key => $sanitize ) {
		register_post_meta(
			'property',
			$key,
			array(
				'single'            => true,
				'type'              => 'string',
				'description'       => $descriptions[ $key ] ?? '',
				'show_in_rest'      => true,
				'sanitize_callback' => $sanitize,
				'auth_callback'     => $auth,
			)
		);
	}

	register_post_meta(
		'property',
		'lh_price_from',
		array(
			'single'            => true,
			'type'              => 'number',
			'show_in_rest'      => true,
			'sanitize_callback' => 'lh_sanitize_price',
			'auth_callback'     => $auth,
		)
	);
}
add_action( 'init', 'lh_register_property_meta' );

// Non-numeric input becomes an empty string rather than 0.
function lh_sanitize_price( $value ) {
	return is_numeric( $value ) ? (float) $value : '';
}

function lh_activate() {
	lh_register_property_type();
	flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'lh_activate' );

register_deactivation_hook( __FILE__, 'flush_rewrite_rules' );
