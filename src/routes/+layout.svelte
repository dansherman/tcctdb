<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<header id="site_title">
	<div>
		<a href="/">TCCTDB</a>
	</div>
	<nav>
		<a href="/shows">Shows</a>
		<a href="/people">People</a>
		<a href="/companies">Companies</a>
	</nav>
</header>
<main>
	{@render children()}
</main>
<footer>
	A project of 4 Community Theater
</footer>
