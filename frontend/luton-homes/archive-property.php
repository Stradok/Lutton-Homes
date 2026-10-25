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
	<section class="lh-section lh-section--paper">
		<div class="lh-wrap">
			<h1>Our homes</h1>
			<?php if ( $lh_homes->have_posts() ) : ?>
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
</main>
<?php
get_footer();
