<?php
defined( 'ABSPATH' ) || exit;

$lh_tones = array( 'sky', 'paper', 'ink' );
$lh_tone  = $lh_tones[ ( isset( $args['index'] ) ? (int) $args['index'] : 0 ) % 3 ];
$lh_name  = lh_post_title( get_the_ID() );
$lh_link  = get_permalink();

$lh_details = array();
foreach ( array( 'lh_beds', 'lh_airport_distance' ) as $lh_key ) {
	$lh_value = lh_property_text( get_the_ID(), $lh_key );
	if ( '' !== $lh_value ) {
		$lh_details[] = $lh_value;
	}
}
?>
<li class="lh-tile lh-tile--<?php echo esc_attr( $lh_tone ); ?>">
	<?php if ( has_post_thumbnail() ) : ?>
		<?php the_post_thumbnail( 'medium_large', array( 'class' => 'lh-photo' ) ); ?>
	<?php else : ?>
		<div class="lh-photo lh-photo--empty"><span>Photos coming soon</span></div>
	<?php endif; ?>
	<div class="lh-home-body">
		<h3 class="lh-home-name"><a href="<?php echo esc_url( $lh_link ); ?>"><?php echo esc_html( $lh_name ); ?></a></h3>
		<p class="lh-home-by">by Luton Homes</p>
		<?php foreach ( $lh_details as $lh_detail ) : ?>
			<p class="lh-home-detail"><?php echo esc_html( $lh_detail ); ?></p>
		<?php endforeach; ?>
		<p>
			<a class="lh-home-ask" href="<?php echo esc_url( lh_whatsapp_url( 'Hello Luton Homes, I am interested in ' . $lh_name . '.' ) ); ?>">Ask about <?php echo esc_html( $lh_name ); ?></a>
		</p>
	</div>
</li>
