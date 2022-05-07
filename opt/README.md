## If you want to install your own custom packages,
Open terminal here

```bash
mkdir myrepo
```

```bash
cd myrepo
```

### Upload all your packages inside 'myrepo'

#### Make your packages database

```bash
repo-add ./shastrarepo.db.tar.gz package-name.pkg.tar.zst
```

### Edit pacman.conf file

Add this inside pacman.conf (at bottom of the page)
```
[myrepo]
SigLevel = Optional TrustAll
Server = file:///opt/myrepo
```
