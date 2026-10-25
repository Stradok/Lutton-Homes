<?php
/**
 * Creates the seed properties listed in properties.json (this directory) as drafts.
 * Run by seed-properties.sh through `wp eval-file`. A property whose slug already exists (any status
 * except trash) is left alone, so owner edits survive re-runs. The whole file is validated before the
 * first post is created.
 */

const LH_SEED_STRING_KEYS = array( 'lh_beds', 'lh_amenities', 'lh_house_rules', 'lh_map_url', 'lh_airport_distance' );

function lh_seed_die( $message ) {
	fwrite( STDERR, 'FAIL: ' . $message . PHP_EOL );
	exit( 1 );
}

function lh_seed_load( $path ) {
	if ( ! is_readable( $path ) ) {
		lh_seed_die( "cannot read $path" );
	}
	$rows = json_decode( file_get_contents( $path ), true );
	if ( JSON_ERROR_NONE !== json_last_error() ) {
		lh_seed_die( 'invalid JSON in ' . $path . ': ' . json_last_error_msg() );
	}
	if ( ! is_array( $rows ) || array_values( $rows ) !== $rows || 5 !== count( $rows ) ) {
		lh_seed_die( 'properties.json must be an array of exactly five objects' );
	}
	return $rows;
}

function lh_seed_validate( $rows ) {
	$slugs = array();
	foreach ( $rows as $i => $row ) {
		$where = 'property ' . ( $i + 1 );
		if ( ! is_array( $row ) || ! isset( $row['title'], $row['slug'], $row['meta'] ) ) {
			lh_seed_die( "$where must be an object with title, slug and meta" );
		}
		if ( ! is_string( $row['title'] ) || '' === trim( $row['title'] ) || ! is_string( $row['slug'] ) || '' === $row['slug'] ) {
			lh_seed_die( "$where needs a non-empty string title and slug" );
		}
		if ( isset( $slugs[ $row['slug'] ] ) ) {
			lh_seed_die( "$where repeats the slug {$row['slug']}" );
		}
		$slugs[ $row['slug'] ] = true;

		if ( ! is_array( $row['meta'] ) ) {
			lh_seed_die( "$where meta must be an object" );
		}
		foreach ( $row['meta'] as $key => $value ) {
			if ( 'lh_price_from' === $key ) {
				if ( null !== $value && ! is_int( $value ) && ! is_float( $value ) ) {
					lh_seed_die( "$where: lh_price_from must be a number or null" );
				}
			} elseif ( in_array( $key, LH_SEED_STRING_KEYS, true ) ) {
				if ( ! is_string( $value ) ) {
					lh_seed_die( "$where: $key must be a string" );
				}
			} else {
				lh_seed_die( "$where: unknown meta key $key" );
			}
		}
	}
}

function lh_seed_find( $slug ) {
	$ids = get_posts(
		array(
			'post_type'   => 'property',
			'name'        => $slug,
			'post_status' => 'any',
			'numberposts' => 1,
			'fields'      => 'ids',
		)
	);
	return $ids ? $ids[0] : 0;
}

function lh_seed_create( $row ) {
	$post_id = wp_insert_post(
		array(
			'post_type'   => 'property',
			'post_status' => 'draft',
			'post_title'  => $row['title'],
			'post_name'   => $row['slug'],
		),
		true
	);
	if ( is_wp_error( $post_id ) ) {
		lh_seed_die( "could not create {$row['title']}: " . $post_id->get_error_message() );
	}
	foreach ( $row['meta'] as $key => $value ) {
		// A null price is not written: no price until the owners supply one.
		if ( null !== $value ) {
			update_post_meta( $post_id, $key, $value );
		}
	}
}

function lh_seed_run( $json_path ) {
	$rows = lh_seed_load( $json_path );
	lh_seed_validate( $rows );

	$created = 0;
	foreach ( $rows as $row ) {
		if ( lh_seed_find( $row['slug'] ) ) {
			echo "exists: {$row['title']}\n";
			continue;
		}
		lh_seed_create( $row );
		echo "created: {$row['title']}\n";
		++$created;
	}
	echo 'seed done: ' . $created . ' created, ' . ( count( $rows ) - $created ) . " already existed\n";
}

// Optional first argument (wp eval-file <this file> <json path>): defaults to properties.json here.
lh_seed_run( isset( $args[0] ) ? $args[0] : __DIR__ . '/properties.json' );
