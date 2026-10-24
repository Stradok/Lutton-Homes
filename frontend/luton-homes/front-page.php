<?php
defined( 'ABSPATH' ) || exit;

get_header();

$lh_homes = new WP_Query(
	array(
		'post_type'      => 'property',
		'post_status'    => 'publish',
		'orderby'        => 'title',
		'order'          => 'ASC',
		'posts_per_page' => -1,
		'no_found_rows'  => true,
	)
);
?>
<main id="content">
	<section class="lh-hero">
		<div class="lh-wrap lh-hero-inner">
			<div class="lh-hero-copy">
				<h1>Homes near Luton Airport, booked direct</h1>
				<p>Five short-stay homes run by one team. Tell us your dates and we will check availability.</p>
			</div>
			<form id="lh-search" class="lh-search" action="<?php echo esc_url( lh_whatsapp_url() ); ?>" method="get" target="_blank" rel="noopener" data-whatsapp-number="<?php echo esc_attr( LH_WHATSAPP_NUMBER ); ?>" novalidate>
				<div class="lh-search-head">
					<h2 class="lh-search-title">Plan your stay</h2>
					<span class="lh-search-code" aria-hidden="true">LTN</span>
				</div>
				<div class="lh-search-body">
					<div class="lh-field">
						<label for="lh-checkin">Check in</label>
						<input id="lh-checkin" type="date">
					</div>
					<div class="lh-field">
						<label for="lh-checkout">Check out</label>
						<input id="lh-checkout" type="date">
					</div>
					<div class="lh-field">
						<label for="lh-guests">Guests</label>
						<input id="lh-guests" type="number" min="1" value="2" required>
					</div>
					<button type="submit" class="lh-button lh-button--primary lh-search-submit">Check availability on WhatsApp</button>
					<p id="lh-search-error" class="lh-search-error" role="alert"></p>
					<p class="lh-note">Online booking is coming soon. For now we reply on WhatsApp.</p>
				</div>
			</form>
		</div>
	</section>

	<section id="homes" class="lh-section lh-section--paper">
		<div class="lh-wrap">
			<?php if ( $lh_homes->have_posts() ) : ?>
				<h2>Five homes, one team</h2>
				<p class="lh-intro">Each home keeps its own name. Photos and details are on the way.</p>
				<ul class="lh-homes">
					<?php while ( $lh_homes->have_posts() ) : $lh_homes->the_post(); ?>
						<?php get_template_part( 'template-parts/property-card', null, array( 'index' => $lh_homes->current_post ) ); ?>
					<?php endwhile; ?>
				</ul>
			<?php else : ?>
				<p class="lh-empty">Homes will appear here soon.</p>
			<?php endif; ?>
			<?php wp_reset_postdata(); ?>
		</div>
	</section>

	<section id="why-direct" class="lh-band lh-band--sky">
		<div class="lh-wrap">
			<h2>Why book with us directly</h2>
			<ul class="lh-points">
				<li><strong class="lh-point-lead">Talk to a person.</strong> Message us on WhatsApp and the team that looks after the homes answers.</li>
				<li><strong class="lh-point-lead">Clear check-in details.</strong> We send check-in instructions before you arrive.</li>
				<li><strong class="lh-point-lead">Pay securely online.</strong> Card, Apple Pay and Google Pay, once online booking opens.</li>
			</ul>
		</div>
	</section>

	<section id="contact" class="lh-band lh-band--ink">
		<div class="lh-wrap">
			<h2>Questions before you book?</h2>
			<p>Message us on WhatsApp or find us at 34 Beaconsfield, Luton LU2 0RW.</p>
			<a class="lh-button lh-button--primary" href="<?php echo esc_url( lh_whatsapp_url() ); ?>">Message us on WhatsApp</a>
		</div>
	</section>
</main>
<?php
get_footer();
