<?php
defined( 'ABSPATH' ) || exit;

get_header();
?>
<main id="content">
	<?php while ( have_posts() ) : the_post(); ?>
		<?php
		$lh_post_id = get_the_ID();
		$lh_name    = lh_post_title( $lh_post_id );
		$lh_price   = lh_property_price( $lh_post_id );
		$lh_map     = lh_property_text( $lh_post_id, 'lh_map_url' );
		$lh_details = array_filter(
			array(
				'Beds'                    => lh_property_text( $lh_post_id, 'lh_beds' ),
				'Distance to the airport' => lh_property_text( $lh_post_id, 'lh_airport_distance' ),
				'Amenities'               => lh_property_text( $lh_post_id, 'lh_amenities' ),
				'House rules'             => lh_property_text( $lh_post_id, 'lh_house_rules' ),
				'Price from'              => null === $lh_price ? '' : '£' . number_format( $lh_price, floor( $lh_price ) === $lh_price ? 0 : 2 ),
			),
			static fn( string $value ): bool => '' !== $value
		);
		?>
		<section class="lh-property-hero">
			<div class="lh-wrap lh-property-hero-inner">
				<div>
					<h1><?php echo esc_html( $lh_name ); ?></h1>
					<p class="lh-property-by">by Luton Homes</p>
				</div>
				<?php if ( has_post_thumbnail() ) : ?>
					<?php the_post_thumbnail( 'large', array( 'class' => 'lh-photo' ) ); ?>
				<?php else : ?>
					<div class="lh-photo lh-photo--empty"><span>Photos coming soon</span></div>
				<?php endif; ?>
			</div>
		</section>

		<section class="lh-property-body">
			<div class="lh-wrap">
				<div class="lh-prose"><?php the_content(); ?></div>
				<?php if ( $lh_details || '' !== $lh_map ) : ?>
					<dl class="lh-details">
						<?php foreach ( $lh_details as $lh_label => $lh_value ) : ?>
							<div>
								<dt><?php echo esc_html( $lh_label ); ?></dt>
								<dd><?php echo nl2br( esc_html( $lh_value ) ); ?></dd>
							</div>
						<?php endforeach; ?>
						<?php if ( '' !== $lh_map ) : ?>
							<div>
								<dt>Map</dt>
								<dd><a href="<?php echo esc_url( $lh_map ); ?>">View on map</a></dd>
							</div>
						<?php endif; ?>
					</dl>
				<?php else : ?>
					<p>Details are on the way.</p>
				<?php endif; ?>
				<div class="lh-actions">
					<a class="lh-button lh-button--primary" href="<?php echo esc_url( lh_whatsapp_url( 'Hello Luton Homes, I am interested in ' . $lh_name . '.' ) ); ?>">Ask about <?php echo esc_html( $lh_name ); ?> on WhatsApp</a>
					<a class="lh-link" href="<?php echo esc_url( get_post_type_archive_link( 'property' ) ); ?>">All homes</a>
				</div>
			</div>
		</section>
	<?php endwhile; ?>
</main>
<?php
get_footer();
